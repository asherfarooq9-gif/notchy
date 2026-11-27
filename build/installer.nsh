; Extra steps for the Notchy installer (see nsis.include in package.json).

; A first install goes to %LOCALAPPDATA%\Programs\Notchy. Without this the folder is named after the npm package
; ("windows-notch"). An existing install keeps its own folder, so updates never move the app.
!macro preInit
  SetRegView 64
  ReadRegStr $0 HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation
  ${If} $0 == ""
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$LOCALAPPDATA\Programs\Notchy"
  ${EndIf}
!macroend

; Uninstalling also removes the "start with Windows" entry the app wrote, so Windows never tries to start a program that is gone.
; An update runs this uninstaller too, so it is skipped then: the app is not always started again after an update,
; and without the entry it would not start with Windows either.
!macro customUnInstall
  ${ifNot} ${isUpdated}
    DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "WindowsNotch"
  ${endIf}
!macroend
