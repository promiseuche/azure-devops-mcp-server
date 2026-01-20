import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

export interface WorkItem {
  id: number;
  rev: number;
  fields: Record<string, any>;
  url: string;
}

export interface Project {
  id: string;
  name: string;
  description: string;
  url: string;
}

export interface Build {
  id: number;
  buildNumber: string;
  status: string;
  result: string;
  queueTime: string;
  startTime: string;
  finishTime: string;
  sourceBranch: string;
}

export interface Release {
  id: number;
  name: string;
  status: string;
  createdOn: string;
  modifiedOn: string;
}

export interface Repository {
  id: string;
  name: string;
  url: string;
  webUrl: string;
  size?: number;
  isDisabled?: boolean;
  isFork?: boolean;
  isInMaintenance?: boolean;
}

export interface Branch {
  name: string;
  objectId: string;
  creator?: {
    displayName: string;
    uniqueName: string;
  };
}

export interface PullRequest {
  pullRequestId: number;
  repository: {
    id: string;
    name: string;
  };
  title: string;
  description?: string;
  createdBy: {
    displayName: string;
    uniqueName: string;
  };
  creationDate: string;
  status: string;
  sourceRefName: string;
  targetRefName: string;
  isDraft?: boolean;
}

export interface Wiki {
  id: string;
  name: string;
  projectId: string;
  repositoryId?: string;
  type: string;
}

export interface Iteration {
  id: string;
  name: string;
  path: string;
  attributes: {
    startDate?: string;
    finishDate?: string;
  };
}

export interface TestPlan {
  id: number;
  name: string;
  description?: string;
  areaPath?: string;
  iteration?: string;
}

export class AzureDevOpsClient {
  private axiosInstance: AxiosInstance;
  private organization: string;
  private project: string;
  private pat: string;

  constructor() {
    const orgUrl = process.env.AZURE_DEVOPS_ORG_URL;
    if (!orgUrl) {
      throw new Error('AZURE_DEVOPS_ORG_URL is not defined in environment variables');
    }
    this.pat = process.env.AZURE_DEVOPS_PAT || '';
    this.project = process.env.AZURE_DEVOPS_PROJECT || '';

    // Extract organization from URL (e.g., https://dev.azure.com/{organization})
    const match = orgUrl.match(/dev\.azure\.com\/([^\/]+)/);
    if (!match) {
      throw new Error('Invalid AZURE_DEVOPS_ORG_URL format. Expected https://dev.azure.com/{organization}');
    }
    this.organization = match[1];

    const auth = Buffer.from(`:${this.pat}`).toString('base64');
    this.axiosInstance = axios.create({
      baseURL: `https://dev.azure.com/${this.organization}`,
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
  }

  async getProjects(): Promise<Project[]> {
    const response = await this.axiosInstance.get('/_apis/projects?api-version=7.1');
    return response.data.value;
  }

  async getWorkItems(ids: number[]): Promise<WorkItem[]> {
    if (ids.length === 0) return [];
    const idsString = ids.join(',');
    const response = await this.axiosInstance.get(
      `/${this.project}/_apis/wit/workitems?ids=${idsString}&api-version=7.1`
    );
    return response.data.value;
  }

  async queryWorkItems(wiql: string): Promise<WorkItem[]> {
    const response = await this.axiosInstance.post(
      `/${this.project}/_apis/wit/wiql?api-version=7.1`,
      { query: wiql }
    );
    const workItemRefs = response.data.workItems;
    if (!workItemRefs || workItemRefs.length === 0) {
      return [];
    }
    const ids = workItemRefs.map((wi: any) => wi.id);
    return this.getWorkItems(ids);
  }

  async getBuilds(definitionId?: number, top: number = 10): Promise<Build[]> {
    let url = `/${this.project}/_apis/build/builds?api-version=7.1&$top=${top}`;
    if (definitionId) {
      url += `&definitions=${definitionId}`;
    }
    const response = await this.axiosInstance.get(url);
    return response.data.value;
  }

  async getReleases(top: number = 10): Promise<Release[]> {
    const response = await this.axiosInstance.get(
      `/${this.project}/_apis/release/releases?api-version=7.1&$top=${top}`
    );
    return response.data.value;
  }

  async getCurrentUser(): Promise<any> {
    const response = await this.axiosInstance.get('/_apis/connectionData');
    return response.data.authenticatedUser;
  }

  async createWorkItem(
    workItemType: string,
    title: string,
    description?: string,
    additionalFields?: Record<string, any>
  ): Promise<WorkItem> {
    const url = `/${this.project}/_apis/wit/workitems/$${workItemType}?api-version=7.1`;
    const fields: Record<string, any> = {
      'System.Title': title,
      ...(description && { 'System.Description': description }),
      ...additionalFields,
    };
    const patchDocument = Object.entries(fields).map(([op, value]) => ({
      op: 'add',
      path: `/fields/${op}`,
      value,
    }));
    const response = await this.axiosInstance.post(url, patchDocument, {
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });
    return response.data;
  }

  async updateWorkItem(
    id: number,
    fields: Record<string, any>,
    comment?: string
  ): Promise<WorkItem> {
    const url = `/${this.project}/_apis/wit/workitems/${id}?api-version=7.1`;
    const patchDocument = Object.entries(fields).map(([field, value]) => ({
      op: 'add',
      path: `/fields/${field}`,
      value,
    }));
    if (comment) {
      patchDocument.push({
        op: 'add',
        path: '/fields/System.History',
        value: comment,
      });
    }
    const response = await this.axiosInstance.patch(url, patchDocument, {
      headers: {
        'Content-Type': 'application/json-patch+json',
      },
    });
    return response.data;
  }

  async assignWorkItem(
    id: number,
    assignee: string,
    comment?: string
  ): Promise<WorkItem> {
    return this.updateWorkItem(
      id,
      { 'System.AssignedTo': assignee },
      comment
    );
  }

  // Repository methods
  async getRepositories(project?: string): Promise<Repository[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/git/repositories?api-version=7.1`
    );
    return response.data.value;
  }

  async getBranches(repositoryId: string, project?: string): Promise<Branch[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/git/repositories/${repositoryId}/refs?filter=heads&api-version=7.1`
    );
    return response.data.value.map((ref: any) => ({
      name: ref.name.replace('refs/heads/', ''),
      objectId: ref.objectId,
      creator: ref.creator,
    }));
  }

  async getPullRequests(
    repositoryId?: string,
    project?: string,
    top: number = 100,
    status: string = 'active'
  ): Promise<PullRequest[]> {
    const proj = project || this.project;
    let url = `/${proj}/_apis/git/pullrequests?api-version=7.1&$top=${top}&searchCriteria.status=${status}`;
    if (repositoryId) {
      url += `&searchCriteria.repositoryId=${repositoryId}`;
    }
    const response = await this.axiosInstance.get(url);
    return response.data.value.map((pr: any) => ({
      pullRequestId: pr.pullRequestId,
      repository: pr.repository,
      title: pr.title,
      description: pr.description,
      createdBy: pr.createdBy,
      creationDate: pr.creationDate,
      status: pr.status,
      sourceRefName: pr.sourceRefName,
      targetRefName: pr.targetRefName,
      isDraft: pr.isDraft,
    }));
  }

  async getPullRequestById(
    repositoryId: string,
    pullRequestId: number,
    project?: string
  ): Promise<PullRequest> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/git/repositories/${repositoryId}/pullrequests/${pullRequestId}?api-version=7.1`
    );
    const pr = response.data;
    return {
      pullRequestId: pr.pullRequestId,
      repository: pr.repository,
      title: pr.title,
      description: pr.description,
      createdBy: pr.createdBy,
      creationDate: pr.creationDate,
      status: pr.status,
      sourceRefName: pr.sourceRefName,
      targetRefName: pr.targetRefName,
      isDraft: pr.isDraft,
    };
  }

  // Search methods
  async searchCode(
    searchText: string,
    project?: string,
    repository?: string,
    top: number = 5
  ): Promise<any[]> {
    const proj = project || this.project;
    const url = `https://almsearch.dev.azure.com/${this.organization}/_apis/search/codesearchresults?api-version=7.1`;
    const body: any = {
      searchText,
      $top: top,
    };
    const filters: any = {};
    if (proj) filters.Project = [proj];
    if (repository) filters.Repository = [repository];
    if (Object.keys(filters).length > 0) {
      body.filters = filters;
    }
    const response = await this.axiosInstance.post(url, body);
    return response.data.results || [];
  }

  async searchWorkItems(
    searchText: string,
    project?: string,
    top: number = 10
  ): Promise<any[]> {
    const proj = project || this.project;
    const url = `https://almsearch.dev.azure.com/${this.organization}/_apis/search/workitemsearchresults?api-version=7.1`;
    const body: any = {
      searchText,
      $top: top,
    };
    if (proj) {
      body.filters = { 'System.TeamProject': [proj] };
    }
    const response = await this.axiosInstance.post(url, body);
    return response.data.results || [];
  }

  // Wiki methods
  async getWikis(project?: string): Promise<Wiki[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/wiki/wikis?api-version=7.1`
    );
    return response.data.value;
  }

  async getWikiPageContent(
    wikiIdentifier: string,
    project?: string,
    path: string = '/'
  ): Promise<string> {
    const proj = project || this.project;
    const encodedPath = encodeURIComponent(path);
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/wiki/wikis/${wikiIdentifier}/pages?path=${encodedPath}&includeContent=true&api-version=7.1`
    );
    return response.data.content;
  }

  // Work methods
  async getTeamIterations(project: string, team: string): Promise<Iteration[]> {
    const response = await this.axiosInstance.get(
      `/${project}/${team}/_apis/work/teamsettings/iterations?api-version=7.1`
    );
    return response.data.value;
  }

  // Test Plan methods
  async getTestPlans(project: string): Promise<TestPlan[]> {
    try {
      const response = await this.axiosInstance.get(
        `/${project}/_apis/test/plans?api-version=7.1`
      );
      return response.data.value;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Test plans feature not enabled or no test plans
        return [];
      }
      throw error;
    }
  }

  // Core methods
  async getTeams(project: string, mine?: boolean, top?: number, skip?: number): Promise<any[]> {
    let url = `/_apis/projects/${project}/teams?api-version=7.1`;
    const params = new URLSearchParams();
    if (mine !== undefined) params.append('$mine', mine.toString());
    if (top !== undefined) params.append('$top', top.toString());
    if (skip !== undefined) params.append('$skip', skip.toString());
    if (params.toString()) url += `&${params.toString()}`;
    const response = await this.axiosInstance.get(url);
    return response.data.value;
  }

  async searchIdentities(searchFilter: string): Promise<any> {
    // Use VSSPS endpoint
    const url = `https://vssps.dev.azure.com/${this.organization}/_apis/identities`;
    const params = new URLSearchParams({
      'api-version': '7.1',
      'searchFilter': 'General',
      'filterValue': searchFilter,
    });
    // Need to use PAT as Bearer token for VSSPS
    const auth = Buffer.from(`:${this.pat}`).toString('base64');
    const response = await axios.get(`${url}?${params}`, {
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json',
      },
    });
    return response.data;
  }

  // Work Item Types
  async getWorkItemTypes(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/wit/workitemtypes?api-version=7.1`
    );
    return response.data.value;
  }

  // Project Iterations (classification nodes)
  async getIterations(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/work/classificationnodes?structureGroup=Iterations&api-version=7.1`;
    console.log('GET', url);
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.children || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Classification nodes not available or no iterations
        console.log('Iterations not found, returning empty array');
        return [];
      }
      console.error('Error fetching iterations:', error.response?.status, error.response?.data);
      throw error;
    }
  }

  // Build Definitions
  async getBuildDefinitions(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/build/definitions?api-version=7.1`
    );
    return response.data.value;
  }

  // Release Definitions
  async getReleaseDefinitions(project?: string): Promise<any[]> {
    const proj = project || this.project;
    try {
      const response = await this.axiosInstance.get(
        `/${proj}/_apis/release/definitions?api-version=7.1`
      );
      return response.data.value;
    } catch (error: any) {
      if (error.response?.status === 404) {
        // Release definitions feature not enabled or no definitions
        return [];
      }
      throw error;
    }
  }

  // Queries
  async getQueries(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/wit/queries?api-version=7.1`
    );
    return response.data.value;
  }

  // Work Item Revisions
  async getWorkItemRevisions(id: number, project?: string): Promise<any[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/wit/workitems/${id}/revisions?api-version=7.1`
    );
    return response.data.value;
  }

  // Work Item Links
  async getWorkItemLinks(id: number, project?: string): Promise<any[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`
    );
    return response.data.relations || [];
  }

  // Create Pull Request
  async createPullRequest(
    repositoryId: string,
    sourceBranch: string,
    targetBranch: string,
    title: string,
    description?: string,
    project?: string
  ): Promise<any> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/git/repositories/${repositoryId}/pullrequests?api-version=7.1`;
    const body = {
      sourceRefName: `refs/heads/${sourceBranch}`,
      targetRefName: `refs/heads/${targetBranch}`,
      title,
      description,
    };
    const response = await this.axiosInstance.post(url, body);
    return response.data;
  }

  // Get Commits
  async getCommits(repositoryId: string, project?: string, top: number = 10): Promise<any[]> {
    const proj = project || this.project;
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/git/repositories/${repositoryId}/commits?api-version=7.1&$top=${top}`
    );
    return response.data.value;
  }

  // Get File Content
  async getFileContent(repositoryId: string, path: string, project?: string): Promise<string> {
    const proj = project || this.project;
    const encodedPath = encodeURIComponent(path);
    const response = await this.axiosInstance.get(
      `/${proj}/_apis/git/repositories/${repositoryId}/items?path=${encodedPath}&api-version=7.1`
    );
    return response.data;
  }

  // List areas (classification nodes)
  async getAreas(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/wit/classificationnodes?structureGroup=Areas&api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.children || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // Get iteration capacities for a team
  async getIterationCapacities(project: string, team: string, iterationId: string): Promise<any[]> {
    const url = `/${project}/${team}/_apis/work/teamsettings/iterations/${iterationId}/capacities?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List work item categories
  async getWorkItemCategories(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/wit/workitemtypecategories?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List dashboards
  async getDashboards(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/dashboard/dashboards?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List pipelines (YAML)
  async getPipelines(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/pipelines?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List test suites in a test plan
  async getTestSuites(project: string, planId: number): Promise<any[]> {
    const url = `/${project}/_apis/test/plans/${planId}/suites?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List variable groups
  async getVariableGroups(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/distributedtask/variablegroups?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List service endpoints
  async getServiceEndpoints(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/serviceendpoint/endpoints?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List tags (project-level tags)
  async getTags(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/tagging/scopes/${proj}/tags?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List team members
  async getTeamMembers(project: string, team: string): Promise<any[]> {
    const url = `/_apis/projects/${project}/teams/${team}/members?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List boards for a team
  async getBoards(project: string, team: string): Promise<any[]> {
    const url = `/${project}/${team}/_apis/work/boards?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List board columns
  async getBoardColumns(project: string, team: string, board: string): Promise<any[]> {
    const url = `/${project}/${team}/_apis/work/boards/${board}/columns?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List board rows
  async getBoardRows(project: string, team: string, board: string): Promise<any[]> {
    const url = `/${project}/${team}/_apis/work/boards/${board}/rows?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List work item states for a work item type
  async getWorkItemStates(project: string, workItemType: string): Promise<any[]> {
    const url = `/${project}/_apis/wit/workitemtypes/${workItemType}/states?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List work item fields
  async getWorkItemFields(project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/wit/fields?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List work item updates
  async getWorkItemUpdates(id: number, project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/wit/workitems/${id}/updates?api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List work item attachments
  async getWorkItemAttachments(id: number, project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/wit/attachments?artifactId=${id}&api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.value || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List work item comments
  async getWorkItemComments(id: number, project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/wit/workitems/${id}/comments?api-version=7.1-preview.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.comments || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List work item relations (same as getWorkItemLinks)
  async getWorkItemRelations(id: number, project?: string): Promise<any[]> {
    const proj = project || this.project;
    const url = `/${proj}/_apis/wit/workitems/${id}?$expand=relations&api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      return response.data.relations || [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }

  // List work item query results (run a saved query)
  async getQueryResults(project: string, queryId: string): Promise<any[]> {
    const url = `/${project}/_apis/wit/queries/${queryId}?$expand=results&api-version=7.1`;
    try {
      const response = await this.axiosInstance.get(url);
      // The response may contain a wiql property and results array
      if (response.data.results && response.data.results.workItems) {
        const workItemRefs = response.data.results.workItems;
        const ids = workItemRefs.map((wi: any) => wi.id);
        return this.getWorkItems(ids);
      }
      return [];
    } catch (error: any) {
      if (error.response?.status === 404) {
        return [];
      }
      throw error;
    }
  }
}