# SangueSolidario
Repositório que contém toda a lógica do webapp "SangueSolidario".

# Deploy
* Todo o processo de deploy foi automatizado utilizando o script Powershell `automate.ps1`.

* Se é for a primeira vez a fazer o deploy ou caso tenha eliminado o grupo de recursos anterior é importante passar a flag `-github` quando for executar o script.

* Para executar o script fazendo bypass da política de execução do Windows, pode utilizar: `powershell -ExecutionPolicy Bypass -File automate.ps1 -github`