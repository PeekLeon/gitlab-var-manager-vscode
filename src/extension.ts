import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as childProcess from 'child_process';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';


const exec = util.promisify(childProcess.exec);

let privateToken: string | undefined;
let defaultSavPath: string | undefined;

interface GitLabTokenPair {
    domain: string;
    privateToken: string;
    defaultSavPath: string;
}

// Function to get private token and defaultSavPath for a specific domain
function getPrivateTokenAndPathForDomain(domain: string): { privateToken: string, defaultSavPath: string } | undefined {
    const gitlabTokens: GitLabTokenPair[] = vscode.workspace.getConfiguration('gitvarmng').get('gitlabTokens') || [];
    const matchingToken = gitlabTokens.find((pair: GitLabTokenPair) => pair.domain === domain);

    if (matchingToken) {
        return { privateToken: matchingToken.privateToken, defaultSavPath: matchingToken.defaultSavPath };
    } else {
        vscode.window.showWarningMessage(`Private token not found for the domain: ${domain}`);
        return { privateToken: '', defaultSavPath: '' }; // You may want to handle this case differently
    }
}


interface FormData {
    folder: string;
    customPath?: string;
}

async function getGitRemoteOrigin(folder: string): Promise<string> {
    try {
        const { stdout } = await exec('git remote get-url origin', { cwd: folder });
        return stdout.trim();
    } catch (error) {
        vscode.window.showWarningMessage('Are you kidding me? Is this a valid GitLab project?');
        return ''; // Handle error or show a warning message
    }
}

async function getGitLabProjectId(domain: string, path: string): Promise<number | undefined> {
    try {
        const pathWithoutGit = path.replace(/\.git$/, '');
        const response = await axios.get(
            `${domain}/api/v4/projects/${encodeURIComponent(`${pathWithoutGit}`)}`,
            {
                headers: {
                    'PRIVATE-TOKEN': privateToken
                },
            }
        );

        return response.data.id;
    } catch (error) {
        console.error(error);
        return undefined; // Handle error or show a warning message
    }
}

// Function to recursively fetch all pages and save variables to a file
async function getAllVariablesAndSaveToFile(url: string, customPath: string, allVariables: any[] = []) {
    try {
        // Fetch all variables
        const allVariables = await getAllVariables(url);

        // Fetch all variables
        const saveVariables = await saveVariablesToFile(allVariables, customPath);

    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Error fetching CI/CD variables: ${error.message}`);
        } else {
            throw new Error(`Unknown error: ${error}`);
        }
    }
}


async function saveVariablesToFile(variables: any[], filePath: string): Promise<void> {
    try {
        fs.writeFileSync(filePath, JSON.stringify(variables, null, 2));
        vscode.window.showInformationMessage(`Variables saved to ${filePath} successfully.`);
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Failed to save variables to file: ${error.message}`);
        } else {
            throw new Error(`Unknown error: ${error}`);
        }
    }
}

// Function to extract the URL for the next page from the Link header
function getNextPageUrl(linkHeader: string) {
    const match = linkHeader && linkHeader.match(/<([^>]+)>;\s*rel="next"/);
    return match ? match[1] : null;
}

// PUSH
async function pushVariablesToGitLab(url: string, customPath: string) {
    try {
        // Read variables from the custom path
        const variablesContent = fs.readFileSync(customPath, 'utf8');
        const variables = JSON.parse(variablesContent);

        for (const variable of variables) {
            try {
                // Check if the variable already exists
                const existingVariable = await getExistingVariable(url, variable.key, variable.environment_scope);
                if (existingVariable) {
                    // Use the GitLab API to update the existing variable using PUT
                    await axios.put(`${url}/${encodeURIComponent(variable.key)}?filter[environment_scope]=${encodeURIComponent(variable.environment_scope)}`, variable, {
                        headers: {
                            'PRIVATE-TOKEN': privateToken,
                        },
                    });
                    //console.log(`Variable '${variable.key}' updated successfully.`);
                } else {
                    // Use the GitLab API to create a new variable using POST
                    await axios.post(url, variable, {
                        headers: {
                            'PRIVATE-TOKEN': privateToken,
                        },
                    });
                    //console.log(`Variable '${variable.key}' created successfully.`);
                }
            } catch (error) {
                if (axios.isAxiosError(error)) {
                    throw new Error(`Failed to push variable '${variable.key}': ${error.message}`);
                } else {
                    throw new Error(`Unknown error: ${error}`);
                }
            }
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Error reading variables from file: ${error.message}`);
        } else {
            throw new Error(`Unknown error: ${error}`);
        }
    }
}

async function listEnvironmentScopes(url: string): Promise<string[]> {
    try {
        // Fetch all variables
        const allVariables = await getAllVariables(url);

        // Extract unique environment scopes from all variables
        const scopes = Array.from(new Set(allVariables.map(variable => variable.environment_scope)));

        vscode.window.showInformationMessage(`Environment Scopes: ${scopes.join(', ')}`);
        return scopes;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Failed to retrieve environment scopes: ${error.message}`);
        } else {
            throw new Error(`Unknown error: ${error}`);
        }
    }
}


async function getAllVariables(url: string): Promise<any[]> {
    try {
        let allVariables: any[] = [];
        let nextPageUrl: string | null = url;

        while (nextPageUrl !== null) {
            const response = await axios.get(nextPageUrl, {
                headers: {
                    'PRIVATE-TOKEN': privateToken,
                },
            });

            const variables = response.data;
            allVariables = allVariables.concat(variables);

            // Check if there is a next page
            nextPageUrl = getNextPageUrl(response.headers.link);
        }

        return allVariables;
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Failed to fetch variables: ${error.message}`);
        } else {
            throw new Error(`Unknown error: ${error}`);
        }
    }
}

async function selectEnvironmentScopes(scopes: string[]): Promise<string[] | undefined> {
    const selectedScopes = await vscode.window.showQuickPick(scopes, {
        canPickMany: true,
        placeHolder: 'Select environment scopes (press Enter when done)',
    });

    return selectedScopes;
}

async function deleteVariablesByScope(url: string, selectedScopes: string[]) {
    try {

            // Fetch all variables
        const allVariables = await getAllVariables(url);

        // Delete variables based on the stored array
        for (const variable of allVariables) {
            
            // Check if the environment_scope includes the specified scope
            if (selectedScopes.some(scope => variable.environment_scope.includes(scope))) {
                
                await axios.delete(`${url}/${encodeURIComponent(variable.key)}?filter[environment_scope]=${encodeURIComponent(variable.environment_scope)}`, {
                    headers: {
                        'PRIVATE-TOKEN': privateToken,
                    },
                });
            }
        }

        vscode.window.showInformationMessage(`Deletion of variables with scope '${selectedScopes}' completed for all pages.`);

    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Failed to delete variables: ${error.message}`);
        } else {
            throw new Error(`Unknown error: ${error}`);
        }
    }
}

// Function to check if a variable with the same key and environment scope already exists
async function getExistingVariable(url: string, key: string, environmentScope: string): Promise<any | null> {
    try {
        const apiUrl = `${url}/${encodeURIComponent(key)}?filter[environment_scope]=${encodeURIComponent(environmentScope)}`;

        const response = await axios.get(apiUrl, {
            headers: {
                'PRIVATE-TOKEN': privateToken,
            },
        });

        const existingVariable = response.data;
        // Check if there is a variable with the same key and environment scope
        if (existingVariable && existingVariable.environment_scope === environmentScope) {
            return existingVariable;
        } else {
            return null;
        }
    } catch (error) {
        // Handle errors appropriately
        if (axios.isAxiosError(error) && error.response && error.response.status === 404) {
            return null;
        } else {
            throw error;
        }
    }
}
// Main
export function activate(context: vscode.ExtensionContext) {
  
    // Command for 'GitLab Push Variables'
    let pushVariablesDisposable = vscode.commands.registerCommand('gitvarmng.gitlabPushVariables', async () => {
        main("push");
    });

    // Command for 'GitLab Pull Variables'
    let pullVariablesDisposable = vscode.commands.registerCommand('gitvarmng.gitlabPullVariables', async () => {
        main("pull");
    });

    // Command for 'List GitLab Environment Scopes'
    let delVariablesDisposable = vscode.commands.registerCommand('gitvarmng.gitlabDelVariables', async () => {
        main("del");
    });

    // Add both disposables to the context.subscriptions array
    context.subscriptions.push(pushVariablesDisposable);
    context.subscriptions.push(pullVariablesDisposable);
    context.subscriptions.push(delVariablesDisposable);
    
    async function main(action: string) {
        
        // Selecting folder
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            openLabel: 'Select Gitlab Project'
        });

        if (!folderUri || folderUri.length === 0) {
            vscode.window.showWarningMessage('No Gitlab Project selected.');
            return;
        }

        const folder = folderUri[0].fsPath;

        var customPath = "";

        const formData: FormData = {
            folder,
            customPath
        };

        const remoteOrigin = await getGitRemoteOrigin(formData.folder);
        const [namespace, project] = remoteOrigin.split('/').slice(-2);

        // Use the URL constructor to parse the URL
        const parsedUrl = new URL(remoteOrigin);
        // Extract the first and second parts
        const domain = `${parsedUrl.protocol}//${parsedUrl.host}`;
        const path = parsedUrl.pathname.substring(1); // Exclude the leading "/"

        const domainConf = getPrivateTokenAndPathForDomain(`${parsedUrl.host}`);
        privateToken = domainConf?.privateToken;
        defaultSavPath = domainConf?.defaultSavPath;
        
        const gitLabProjectId = await getGitLabProjectId(domain, path);

        if (gitLabProjectId !== undefined) {
            // Call the function to get all variables
            const urlVariables = `${domain}/api/v4/projects/${encodeURIComponent(`${gitLabProjectId}`)}/variables`;
            

            if (action === "push") {
                const customPathUri = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    defaultUri: defaultSavPath ? vscode.Uri.file(defaultSavPath) : vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
                    openLabel: 'Select file',
                    filters: {
                        'All Files': ['json'],
                    },
                });
    
                if (!customPathUri) {
                    vscode.window.showWarningMessage('No file selected.');
                    return;
                }
                
                customPath = customPathUri[0].fsPath;

                pushVariablesToGitLab(urlVariables, customPath);
            }

            if (action === "del" || action === "pull") {
                
                var delWithSav = false;
                if(action === "del"){
                    delWithSav = await vscode.window.showWarningMessage(
                        "Do you want save all variables before?",
                        { modal: true },
                        'Yes',
                        'No'
                    ) === 'Yes';
                }

                if (action === "pull" || delWithSav) {
                    const customPathUri = await vscode.window.showSaveDialog({
                        defaultUri: defaultSavPath ? vscode.Uri.file(defaultSavPath) : vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
                        filters: {
                            'All Files': ['json'],
                        },
                    });
                    if (!customPathUri) {
                        vscode.window.showWarningMessage('No file selected.');
                        return;
                    }
                    
                    customPath = customPathUri.fsPath;
    
    
                    getAllVariablesAndSaveToFile(urlVariables, customPath)
                    .then(() => {
                        vscode.window.showInformationMessage(`Variables saved to ${customPath} successfully.`);
                    })
                    .catch(error => {
                        console.error(error.message);
                        vscode.window.showErrorMessage(`Failed to save variables to file: ${error.message}`);
                    });
                }

                if(action === "del"){
                    const availableScopes = await listEnvironmentScopes(urlVariables);
                    const selectedScopes = await selectEnvironmentScopes(availableScopes);
                    if (selectedScopes && selectedScopes.length > 0) {
                        vscode.window.showInformationMessage(`Selected Environment Scopes: ${selectedScopes.join(', ')}`);
                        deleteVariablesByScope(urlVariables, selectedScopes);
                    } else {
                        vscode.window.showInformationMessage('No environment scopes selected.');
                    }
                }
            }

        } else {
            vscode.window.showWarningMessage('Failed to retrieve GitLab Project ID.');
        }

        vscode.window.showInformationMessage(`Selected folder: ${formData.folder}, Action: ${action}, Custom Path: ${formData.customPath || 'N/A'}, Git Remote Origin: ${remoteOrigin}`);
    }
}

export function deactivate() {}