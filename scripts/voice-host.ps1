# One long-running speech process: it waits for "hey batman", hears one command, and speaks replies.
# It stays running so there is no start-up delay between "Yes?" and listening (a new process took 1-2 seconds
# and swallowed the first words). It talks to the notch over stdin/stdout, one line per message.
#
# Lines in:  mode off|wake|command|test   say <text>   silence   minwake <0-1>   quit
# Lines out: JSON, e.g. {"e":"wake","text":"hey batman","confidence":0.91}
param(
  [Parameter(Mandatory)][string]$WakePhrases,    # separated by |
  [Parameter(Mandatory)][string]$FixedCommands,  # separated by |
  [Parameter(Mandatory)][string]$OpenTargets,    # separated by |
  [double]$MinWake = 0.6,
  [double]$MinCommand = 0.45
)

$source = @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Speech.Recognition;
using System.Speech.Synthesis;
using System.Threading;

public static class VoiceHost
{
    static readonly object emitLock = new object();
    static readonly object stateLock = new object();
    static readonly CultureInfo Inv = CultureInfo.InvariantCulture;
    static SpeechRecognitionEngine engine;
    static SpeechSynthesizer synth;
    static Grammar wakeGrammar;
    static Grammar commandGrammar;
    static HashSet<string> wakePhrases;
    static double minWake;
    static double minCommand;
    static string wanted = "off";   // what the notch asked for
    static string active = "off";   // what the engine is doing right now
    static bool recognizing = false;
    static int pendingSpeech = 0;
    static DateTime lastLevel = DateTime.MinValue;

    static void Emit(string json)
    {
        lock (emitLock) { Console.Out.WriteLine(json); Console.Out.Flush(); }
    }
    static string Q(string s) { return "\"" + (s ?? "").Replace("\\", "\\\\").Replace("\"", "\\\"") + "\""; }
    static string N(double d) { return d.ToString("0.00", Inv); }
    static string B(bool b) { return b ? "true" : "false"; }
    static void Fail(Exception ex) { Emit("{\"e\":\"error\",\"message\":" + Q(ex.Message) + "}"); }
    static bool IsSpeaking() { return Thread.VolatileRead(ref pendingSpeech) > 0; }

    public static void Run(string[] wake, string[] fixedCommands, string[] openTargets, double wakeMin, double commandMin)
    {
        try
        {
            minWake = wakeMin;
            minCommand = commandMin;
            wakePhrases = new HashSet<string>(wake);

            engine = new SpeechRecognitionEngine();
            // Windows drops anything under 60% on its own. A quiet microphone scores lower than that,
            // so let results through and apply our own thresholds (the sensitivity setting) instead.
            engine.UpdateRecognizerSetting("CFGConfidenceRejectionThreshold", 5);
            engine.InitialSilenceTimeout = TimeSpan.FromSeconds(6);
            engine.BabbleTimeout = TimeSpan.FromSeconds(6);
            engine.EndSilenceTimeoutAmbiguous = TimeSpan.FromMilliseconds(900); // people pause mid-question
            wakeGrammar = BuildWake(wake);
            commandGrammar = BuildCommands(fixedCommands, openTargets);
            engine.LoadGrammar(wakeGrammar);
            engine.LoadGrammar(commandGrammar);
            engine.SetInputToDefaultAudioDevice();
            engine.SpeechRecognized += OnRecognized;
            engine.SpeechRecognitionRejected += OnRejected;
            engine.RecognizeCompleted += OnCompleted;
            engine.AudioLevelUpdated += OnLevel;

            synth = new SpeechSynthesizer();
            try { synth.SelectVoiceByHints(VoiceGender.Male); } catch (Exception) { /* no male voice: keep the default */ }
            synth.SpeakCompleted += OnSpoken;
        }
        catch (Exception ex)
        {
            Fail(ex);
            Environment.Exit(1);
        }

        Emit("{\"e\":\"ready\"}");
        string line;
        while ((line = Console.In.ReadLine()) != null)
        {
            if (line == "quit") break;
            Handle(line);
        }
    }

    static Grammar BuildWake(string[] phrases)
    {
        Grammar g = new Grammar(new GrammarBuilder(new Choices(phrases)));
        g.Name = "wake";
        g.Enabled = false;
        return g;
    }

    static Grammar BuildCommands(string[] fixedCommands, string[] openTargets)
    {
        Choices all = new Choices(fixedCommands);

        GrammarBuilder open = new GrammarBuilder();
        open.Append(new Choices(new string[] { "open", "launch", "start" }));
        open.Append(new Choices(openTargets));
        all.Add(open);

        GrammarBuilder search = new GrammarBuilder();
        search.Append(new Choices(new string[] { "search for", "google", "look up" }));
        search.AppendDictation();
        all.Add(search);

        // Anything else he hears is a free question, passed on to Claude.
        GrammarBuilder anything = new GrammarBuilder();
        anything.AppendDictation();
        all.Add(anything);

        Grammar g = new Grammar(new GrammarBuilder(all));
        g.Name = "command";
        g.Enabled = false;
        return g;
    }

    static void Handle(string line)
    {
        try
        {
            if (line.StartsWith("mode "))
            {
                lock (stateLock) { wanted = line.Substring(5).Trim(); }
                Reconcile();
            }
            else if (line.StartsWith("say "))
            {
                Interlocked.Increment(ref pendingSpeech);
                synth.SpeakAsync(line.Substring(4));
            }
            else if (line == "silence")
            {
                synth.SpeakAsyncCancelAll();
            }
            else if (line.StartsWith("minwake "))
            {
                minWake = double.Parse(line.Substring(8).Trim(), Inv);
            }
        }
        catch (Exception ex) { Fail(ex); }
    }

    // Makes the engine match what was asked for. Switching grammars needs a stopped engine,
    // so a running one is cancelled first and OnCompleted calls this again.
    static void Reconcile()
    {
        lock (stateLock)
        {
            if (recognizing)
            {
                if (active != wanted)
                {
                    try { engine.RecognizeAsyncCancel(); } catch (Exception ex) { Fail(ex); }
                }
                return;
            }
            if (wanted == "off") { active = "off"; return; }

            active = wanted;
            wakeGrammar.Enabled = (wanted == "wake" || wanted == "test");
            commandGrammar.Enabled = (wanted == "command");
            try
            {
                recognizing = true;
                engine.RecognizeAsync(wanted == "command" ? RecognizeMode.Single : RecognizeMode.Multiple);
            }
            catch (Exception ex)
            {
                recognizing = false;
                Fail(ex);
            }
        }
    }

    static void OnRecognized(object sender, SpeechRecognizedEventArgs e)
    {
        if (IsSpeaking()) return; // never react to his own voice
        RecognitionResult r = e.Result;
        string text = r.Text ?? "";
        if (r.Grammar.Name == "wake")
        {
            bool ok = wakePhrases.Contains(text) && r.Confidence >= minWake;
            Emit("{\"e\":\"" + (ok ? "wake" : "wake-miss") + "\",\"text\":" + Q(text) + ",\"confidence\":" + N(r.Confidence) + "}");
        }
        else
        {
            bool ok = r.Confidence >= minCommand;
            Emit("{\"e\":\"" + (ok ? "heard" : "unclear") + "\",\"text\":" + Q(text) + ",\"confidence\":" + N(r.Confidence) + "}");
        }
    }

    static void OnRejected(object sender, SpeechRecognitionRejectedEventArgs e)
    {
        if (IsSpeaking()) return;
        string kind = (active == "command") ? "unclear" : "wake-miss";
        string text = (e.Result != null && e.Result.Text != null) ? e.Result.Text : "";
        double confidence = (e.Result != null) ? e.Result.Confidence : 0;
        Emit("{\"e\":\"" + kind + "\",\"text\":" + Q(text) + ",\"confidence\":" + N(confidence) + "}");
    }

    static void OnCompleted(object sender, RecognizeCompletedEventArgs e)
    {
        string was;
        lock (stateLock) { recognizing = false; was = active; }
        if (e.Error != null)
        {
            Fail(e.Error);
        }
        else if (!e.Cancelled && was == "command")
        {
            // One command per request. Go quiet before reporting, so the notch's reply is never overwritten.
            lock (stateLock) { wanted = "off"; }
            Emit("{\"e\":\"completed\",\"silence\":" + B(e.InitialSilenceTimeout) + ",\"babble\":" + B(e.BabbleTimeout) + "}");
        }
        Reconcile();
    }

    static void OnLevel(object sender, AudioLevelUpdatedEventArgs e)
    {
        if (active != "command" && active != "test") return;
        DateTime now = DateTime.UtcNow;
        if ((now - lastLevel).TotalMilliseconds < 100) return;
        lastLevel = now;
        Emit("{\"e\":\"level\",\"v\":" + e.AudioLevel + "}");
    }

    static void OnSpoken(object sender, SpeakCompletedEventArgs e)
    {
        Interlocked.Decrement(ref pendingSpeech);
        Emit("{\"e\":\"spoken\",\"cancelled\":" + B(e.Cancelled) + "}");
    }
}
'@

Add-Type -ReferencedAssemblies 'System.Speech' -TypeDefinition $source
[VoiceHost]::Run($WakePhrases.Split('|'), $FixedCommands.Split('|'), $OpenTargets.Split('|'), $MinWake, $MinCommand)
