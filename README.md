# Gitlab Variables Manager

Manage the variables of your Gitlab CI/CD projects in json format.

## How it's work

Opening Visual Studio Code command palette by `Ctrl + P`

---

### Pull variables from Gitlab project

Command : `Gitlab Pull Variables`

Selecte your Git project then select the destination to pull your variables into json from the Gitlab project.

File example:

```json
[
  {
    "variable_type": "env_var",
    "key": "KEY_1",
    "value": "my_value_for_staging",
    "protected": true,
    "masked": false,
    "raw": true,
    "environment_scope": "staging",
    "description": null
  },
  {
    "variable_type": "env_var",
    "key": "KEY_1",
    "value": "my_value_for_production",
    "protected": true,
    "masked": false,
    "raw": true,
    "environment_scope": "production",
    "description": null
  },
  {
    "variable_type": "env_var",
    "key": "KEY_2",
    "value": "my_other_value",
    "protected": false,
    "masked": false,
    "raw": true,
    "environment_scope": "*",
    "description": null
  },
  ...
]
```
---

### Push variables to Gitlab project

Command : `Gitlab Push Variables`

Selecte your Git project then select the json file to push your variables to the Gitlab project.

---

### Remove variables from Gitlab project

Command : `Gitlab Del Variables`

Choose your Git project and indicate whether you'd like to create a backup. If you opt for a backup, specify the JSON file to retrieve your variables from the GitLab project. Following that, you can choose the scope of environments you wish to delete.

---

### Generate JSON File

Command : `Gitlab Generate json variables file`

This command generates a JSON file containing the environment variables used in the currently open VSCode editor. You can select a custom path to save the generated JSON file.

The function relies on the following settings defined in the extension's **settings.json**:

`excludePrefixes`: An array of string prefixes. Variables starting with any of these prefixes will be excluded from extraction.

`excludeSuffixes`: An array of string suffixes. Variables ending with any of these suffixes will be excluded from extraction.

`excludeContent`: An array of string content. Variables containing any of these strings within their names will be excluded from extraction.

Example:

```json
"gitvarmng.excludePrefixes": [
        "CI_"
],
"gitvarmng.excludeSuffixes": [
    "foo"
],
"gitvarmng.excludeContent": [
    "bar"
]
```

## Gitlab token configuration

Add in your **settings.json** your private token.

Example:

```json
"gitvarmng.gitlabTokens": [
  {
    "domain": "mygitlab-rec.fr",
    "privateToken": "my-gitlab-token-rec",
    "defaultSavPath": "D:\\vbox_data\\var-gitlab\\rec"
  },
  {
    "domain": "mygitlab-prod.fr",
    "privateToken": "y-gitlab-token-prod",
    "defaultSavPath": "D:\\vbox_data\\var-gitlab\\prod"
  },
  ...
]
```


## Release Notes

### 1.3.1 - 2024-03-15
Debug package.json dependencies.

### 1.3.0 - 2024-03-14
Added options for `Gitlab Generate json variables file` functionality.

### 1.2.0 - 2024-03-12
Adding `Gitlab Generate json variables file` functionality.

### 1.1.0 - 2024-03-11
Add a default path per instance for the variable files.
Set this parameter to `defaultSavPath`.

### 1.0.0 - 2024-03-09
First release 🎉


---

## Project

[https://github.com/PeekLeon/gitlab-var-manager-vscode](https://github.com/PeekLeon/gitlab-var-manager-vscode)