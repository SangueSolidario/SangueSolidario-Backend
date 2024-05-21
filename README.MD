# SangueSolidario
Repository containing all the server/API of the "SangueSolidario" webapp.

# Deploy

* The entire deployment process has been automated using the Powershell script `automate.ps1` or `automate.sh` if you want a Shell Script.

* If this is your first time deploying or if you have deleted the previous resource group, it is important to pass the `-github`, `-createVars` and `-genEmail` flag when running the script.

* To run the script bypassing the Windows execution policy, you can use: `powershell -ExecutionPolicy Bypass -File automate.ps1 -github -createVars`.

After running the scripts, these URLs will be available:
* [Swagger](https://webapp-sanguesolidario.azurewebsites.net/api-docs/ ) - Swagger's UI with all the routes, having been generated only for the purpose of automating the import of the API into Azure API Management.
* [API URL](https://sanguesolidario.azure-api.net/api/) - URL to be used for API requests

# Troubleshooting

* For some reason, Github Actions when Azure asks for permission to connect and add the .yaml to deploy the webapp, an unauthorized 401 error is displayed during deployment.

* To make sure everything works, follow the next steps:
  * Fork this repo and change the value of `$email` inside the `automate.ps1` file.
  * If this is the first time you are deploying or if you deleted the previous resource group, run: `powershell -ExecutionPolicy Bypass -File automate.ps1 -github -createVars`.
  * Then, in the Github Actions of your forked repository, re-run the last job that failed due to error 401.
  * Wait for the script to finish running (it may take a while because API Management takes a long time, 25-30 minutes, to activate)
  * After the script has finished and made sure that Github Actions doesn't receive any errors when deploying the application, run: `powershell -ExecutionPolicy Bypass -File automate.ps1`.
  * Everything will work now!
