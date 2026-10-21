Option Explicit

Dim shell, fso, scriptDir, pythonRoot, folder, pythonw, command
Set shell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

scriptDir = fso.GetParentFolderName(WScript.ScriptFullName)
shell.CurrentDirectory = scriptDir
pythonRoot = shell.ExpandEnvironmentStrings("%LOCALAPPDATA%") & "\Python"
pythonw = ""

If fso.FolderExists(pythonRoot) Then
    For Each folder In fso.GetFolder(pythonRoot).SubFolders
        If LCase(Left(folder.Name, 11)) = "pythoncore-" Then
            If fso.FileExists(folder.Path & "\pythonw.exe") Then
                pythonw = folder.Path & "\pythonw.exe"
            End If
        End If
    Next
End If

If pythonw = "" Then
    MsgBox "Python pythonw.exe was not found.", vbExclamation, "Simpsons Inning Checker"
    WScript.Quit 1
End If

command = Chr(34) & pythonw & Chr(34) & " -m video_analysis.app"
shell.Run command, 0, False
