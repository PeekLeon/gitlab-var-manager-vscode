# Gitlab Variables Manager

Pull, Push your CI/CD variables from/to your Gitlab projects in json format.

## How it's work

Opening Visual Studio Code command palette by `Ctrl + P`

# Pull variables from Gitlab project

Use this command : `Gitlab Pull Variables`

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

# Push variables to Gitlab project

Use this command : `Gitlab Push Variables`

Selecte your Git project then select the json file to push your variables to the Gitlab project.


## Configuration

Add in your settings.json your private token.

Example :

```json
"gitvarmng.gitlabTokens": [
  {
    "domain": "mygitlab-rec.fr",
    "privateToken": "my-gitlab-token-rec"
  },
  {
    "domain": "mygitlab-prod.fr",
    "privateToken": "y-gitlab-token-prod"
  },
  ...
]
```


## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

* `myExtension.enable`: Enable/disable this extension.
* `myExtension.thing`: Set to `blah` to do something.

## Known Issues

Calling out known issues can help limit users opening duplicate issues against your extension.

## Release Notes

### 0.0.1-2024-03-07
First version 🎉


---

## Project

[https://github.com/PeekLeon/gitlab-var-manager-vscode](https://github.com/PeekLeon/gitlab-var-manager-vscode)