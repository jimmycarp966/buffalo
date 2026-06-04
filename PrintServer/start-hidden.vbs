Set WshShell = CreateObject("WScript.Shell")
Set FSO = CreateObject("Scripting.FileSystemObject")
scriptDir = FSO.GetParentFolderName(WScript.ScriptFullName)
WshShell.Run chr(34) & scriptDir & "\start-visible.bat" & chr(34), 0
Set FSO = Nothing
Set WshShell = Nothing
