import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as util from 'util';
import * as childProcess from 'child_process';
import axios, { AxiosError, AxiosRequestConfig } from 'axios';


const exec = util.promisify(childProcess.exec);
//const privateToken = getConfigValue('gitvarmng.gitlabTokens');  // Replace with your actual private token
let privateToken: string | undefined;
// Add this interface to your code
interface GitLabTokenPair {
    domain: string;
    privateToken: string;
}

// Function to get private token for a specific domain
function getPrivateTokenForDomain(domain: string): string | undefined {
    const gitlabTokens: GitLabTokenPair[] = vscode.workspace.getConfiguration('gitvarmng').get('gitlabTokens') || [];
    const matchingToken = gitlabTokens.find((pair: GitLabTokenPair) => pair.domain === domain);

    return matchingToken ? matchingToken.privateToken : undefined;
}

// Function to get private token
function getPrivateToken(domain: string): string {
    const token = getPrivateTokenForDomain(domain);
    if (token) {
        return token;
    }else{
        vscode.window.showWarningMessage(`Private token not found for the domain : ${domain}`);
        return '';
    }
    // Use a default token or handle the absence of a token for the domain
    //return getConfigValue('gitvarmng.defaultPrivateToken') || '';
}

interface FormData {
    folder: string;
    customPath?: string;
}

// Define a function to get a value from settings.json
function getConfigValue(key: string): any {
    // Get the configuration for the extension
    const config = vscode.workspace.getConfiguration('gitvarmng');

    // Get the value for the specified key
    return config.get(key);
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
async function getAllVariablesAndSaveToFile(url: string, customPath: string | undefined, allVariables: any[] = []) {
    try {
        const response = await axios.get(url, {
            headers: {
                'PRIVATE-TOKEN': privateToken
            },
        });

        const variables = response.data;
        const nextPageUrl = getNextPageUrl(response.headers.link);

        if (customPath) {
            allVariables = allVariables.concat(variables);

            if (nextPageUrl) {
                return getAllVariablesAndSaveToFile(nextPageUrl, customPath, allVariables);
            } else {
                const filePath = path.join(customPath);
                fs.writeFileSync(filePath, JSON.stringify(allVariables, null, 2));
            }
        }
    } catch (error) {
        if (axios.isAxiosError(error)) {
            throw new Error(`Error fetching CI/CD variables: ${error.message}`);
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
                const existingVariable = await getExistingVariable(url, variable.key);

                if (existingVariable) {
                    // Use the GitLab API to update the existing variable using PUT
                    await axios.put(`${url}/${encodeURIComponent(variable.key)}`, variable, {
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

// Function to check if a variable with the same key already exists
async function getExistingVariable(url: string, key: string): Promise<any | null> {
    try {
        const response = await axios.get(`${url}/${encodeURIComponent(key)}`, {
            headers: {
                'PRIVATE-TOKEN': privateToken,
            },
        });
        return response.data;
    } catch (error) {
        // If the variable doesn't exist, return null
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

    // Add both disposables to the context.subscriptions array
    context.subscriptions.push(pushVariablesDisposable);
    context.subscriptions.push(pullVariablesDisposable);

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
        if (action === "pull") {
            const customPathUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.workspace.workspaceFolders ? vscode.workspace.workspaceFolders[0].uri : undefined,
                filters: {
                    'All Files': ['*'],
                },
            });
            if (!customPathUri) {
                vscode.window.showWarningMessage('No file selected.');
                return;
            }
            
            customPath = customPathUri.fsPath;
        } else {
            const customPathUri = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
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
        }
        
        const formData: FormData = {
            folder,
            //action: selectedAction.label.toLowerCase() as 'push' | 'pull',
            customPath
        };

        const remoteOrigin = await getGitRemoteOrigin(formData.folder);
        const [namespace, project] = remoteOrigin.split('/').slice(-2);

        // Use the URL constructor to parse the URL
        const parsedUrl = new URL(remoteOrigin);
        // Extract the first and second parts
        const domain = `${parsedUrl.protocol}//${parsedUrl.host}`;
        const path = parsedUrl.pathname.substring(1); // Exclude the leading "/"

        privateToken = getPrivateToken(`${parsedUrl.host}`);

        const gitLabProjectId = await getGitLabProjectId(domain, path);

        if (gitLabProjectId !== undefined) {
            //vscode.window.showInformationMessage(`GitLab Project ID: ${gitLabProjectId}`);
            
            
            
            // Call the function to get all variables
            const urlVariables = `${domain}/api/v4/projects/${encodeURIComponent(`${gitLabProjectId}`)}/variables`;
            if (action === "pull") {
                getAllVariablesAndSaveToFile(urlVariables, customPath)
                .then(() => {
                    vscode.window.showInformationMessage('Variables saved to file successfully.');
                })
                .catch(error => {
                    console.error(error.message);
                    vscode.window.showErrorMessage(`Failed to save variables to file: ${error.message}`);
                });
            }

            if (action === "push") {
                pushVariablesToGitLab(urlVariables, customPath);
            }

        } else {
            vscode.window.showWarningMessage('Failed to retrieve GitLab Project ID.');
        }

        vscode.window.showInformationMessage(`Selected folder: ${formData.folder}, Action: ${action}, Custom Path: ${formData.customPath || 'N/A'}, Git Remote Origin: ${remoteOrigin}`);
    }
}

export function deactivate() {}