// The tools that can live in the panel, in their default order. "id" is what is saved in settings.
const MODULES = [
  { id: 'home', title: 'Home' },
  { id: 'clock', title: 'Clock' },
  { id: 'timers', title: 'Timers' },
  { id: 'notes', title: 'Notes' },
  { id: 'clipboard', title: 'Clipboard' },
  { id: 'links', title: 'Links' },
  { id: 'message', title: 'Message' },
  { id: 'system', title: 'System' },
  { id: 'units', title: 'Units' },
  { id: 'weather', title: 'Weather' },
  { id: 'calendar', title: 'Calendar' },
  { id: 'shelf', title: 'Shelf' },
  { id: 'converter', title: 'Converter' },
  { id: 'screentime', title: 'Screen Time' },
  { id: 'assistant', title: 'Assistant' },
  { id: 'music', title: 'Music' },
  { id: 'phone', title: 'Phone' },
];

const MODULE_IDS = MODULES.map((m) => m.id);

module.exports = { MODULES, MODULE_IDS };
