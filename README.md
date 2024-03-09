# Gitlab Variables Manager

Pull, Push your CI/CD variables from/to your Gitlab projects in json format.

## How it's work

Opening Visual Studio Code command palette by `Ctrl + P`

---

### Pull variables from Gitlab project

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
---

### Push variables to Gitlab project

Use this command : `Gitlab Push Variables`

Selecte your Git project then select the json file to push your variables to the Gitlab project.

---

### Remove variables from Gitlab project

Use this command : `Gitlab Del Variables`

Choose your Git project and indicate whether you'd like to create a backup. If you opt for a backup, specify the JSON file to retrieve your variables from the GitLab project. Following that, you can choose the scope of environments you wish to delete.

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


## Release Notes

### 1.0.0 - 2024-03-09
First release 🎉


---

## Project

[https://github.com/PeekLeon/gitlab-var-manager-vscode](https://github.com/PeekLeon/gitlab-var-manager-vscode)