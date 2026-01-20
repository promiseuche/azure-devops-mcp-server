import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import { AzureDevOpsClient } from './azure-devops-client.js';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import OpenAI from 'openai';

dotenv.config();

// Initialize Azure OpenAI
const openai = new OpenAI({
  apiKey: process.env.AZURE_OPENAI_API_KEY,
  baseURL: `${process.env.AZURE_OPENAI_ENDPOINT}/openai/deployments/${process.env.AZURE_OPENAI_DEPLOYMENT_NAME}`,
  defaultQuery: { 'api-version': process.env.AZURE_OPENAI_API_VERSION },
});

// Create MCP server
const server = new Server(
  {
    name: 'azure-devops-mcp-server',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const azureClient = new AzureDevOpsClient();

// Define MCP tools
const tools: Tool[] = [
  {
    name: 'list_projects',
    description: 'List all projects in the Azure DevOps organization',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_project_teams',
    description: 'Retrieve a list of teams for the specified Azure DevOps project.',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'The name or ID of the Azure DevOps project.',
        },
        mine: {
          type: 'boolean',
          description: 'If true, only return teams that the authenticated user is a member of.',
        },
        top: {
          type: 'number',
          description: 'The maximum number of teams to return. Defaults to 100.',
        },
        skip: {
          type: 'number',
          description: 'The number of teams to skip for pagination. Defaults to 0.',
        },
      },
      required: ['project'],
    },
  },
  {
    name: 'get_identity_ids',
    description: 'Retrieve Azure DevOps identity IDs for a provided search filter.',
    inputSchema: {
      type: 'object',
      properties: {
        searchFilter: {
          type: 'string',
          description: 'Search filter (unique name, display name, email) to retrieve identity IDs for.',
        },
      },
      required: ['searchFilter'],
    },
  },
  {
    name: 'query_work_items',
    description: 'Query work items using WIQL (Azure DevOps Query Language)',
    inputSchema: {
      type: 'object',
      properties: {
        wiql: {
          type: 'string',
          description: 'WIQL query string, e.g., SELECT [System.Id] FROM WorkItems WHERE [System.State] = \'Active\'',
        },
      },
      required: ['wiql'],
    },
  },
  {
    name: 'get_work_items_by_ids',
    description: 'Get work items by their IDs',
    inputSchema: {
      type: 'object',
      properties: {
        ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Array of work item IDs',
        },
      },
      required: ['ids'],
    },
  },
  {
    name: 'get_builds',
    description: 'Get recent builds for the project',
    inputSchema: {
      type: 'object',
      properties: {
        definitionId: {
          type: 'number',
          description: 'Optional build definition ID to filter',
        },
        top: {
          type: 'number',
          description: 'Number of builds to retrieve (default 10)',
          default: 10,
        },
      },
    },
  },
  {
    name: 'get_releases',
    description: 'Get recent releases for the project',
    inputSchema: {
      type: 'object',
      properties: {
        top: {
          type: 'number',
          description: 'Number of releases to retrieve (default 10)',
          default: 10,
        },
      },
    },
  },
  {
    name: 'create_work_item',
    description: 'Create a new work item in Azure DevOps (uses the default project configured in the environment). Provide work item type and title. The project is already set, so you do not need to specify it.',
    inputSchema: {
      type: 'object',
      properties: {
        workItemType: {
          type: 'string',
          description: 'Type of work item (e.g., Issue, Task, Bug, User Story). If the user says "issue work item", use "Issue". If they say "bug", use "Bug". If they say "task", use "Task".',
        },
        title: {
          type: 'string',
          description: 'Title of the work item',
        },
        description: {
          type: 'string',
          description: 'Optional description',
        },
        additionalFields: {
          type: 'object',
          description: 'Additional fields as key-value pairs',
        },
      },
      required: ['workItemType', 'title'],
    },
  },
  {
    name: 'update_work_item',
    description: 'Update fields of an existing work item in Azure DevOps. Provide the work item ID and a fields object with field names (e.g., System.Description) and new values. You can also add an optional comment. Common field mappings: "description" -> System.Description, "title" -> System.Title, "state" -> System.State, "assigned to" -> System.AssignedTo.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'ID of the work item to update',
        },
        fields: {
          type: 'object',
          description: 'Fields to update as key-value pairs (e.g., {"System.Description": "new description", "System.Title": "new title"}). If the user mentions a field like "description", map it to System.Description.',
        },
        comment: {
          type: 'string',
          description: 'Optional comment for the history',
        },
      },
      required: ['id', 'fields'],
    },
  },
  {
    name: 'assign_work_item',
    description: 'Assign a work item to a user. Provide the work item ID and the assignee (user display name or email). Optionally add a comment.',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'ID of the work item to assign',
        },
        assignee: {
          type: 'string',
          description: 'User to assign the work item to (e.g., "John Doe", "john@example.com")',
        },
        comment: {
          type: 'string',
          description: 'Optional comment for the history',
        },
      },
      required: ['id', 'assignee'],
    },
  },
  {
    name: 'list_repositories',
    description: 'List repositories in a project (default project used if not specified)',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_branches',
    description: 'List branches in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: 'Repository ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['repositoryId'],
    },
  },
  {
    name: 'list_pull_requests',
    description: 'List pull requests in a repository or project',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: 'Optional repository ID to filter',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
        top: {
          type: 'number',
          description: 'Number of pull requests to retrieve (default 100)',
          default: 100,
        },
        status: {
          type: 'string',
          description: 'Pull request status (active, completed, abandoned). Default active.',
          default: 'active',
        },
      },
    },
  },
  {
    name: 'get_pull_request',
    description: 'Get details of a specific pull request',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: 'Repository ID',
        },
        pullRequestId: {
          type: 'number',
          description: 'Pull request ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['repositoryId', 'pullRequestId'],
    },
  },
  {
    name: 'search_code',
    description: 'Search for code across repositories',
    inputSchema: {
      type: 'object',
      properties: {
        searchText: {
          type: 'string',
          description: 'Search text',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
        repository: {
          type: 'string',
          description: 'Optional repository name or ID to filter',
        },
        top: {
          type: 'number',
          description: 'Number of results to retrieve (default 5)',
          default: 5,
        },
      },
      required: ['searchText'],
    },
  },
  {
    name: 'search_work_items',
    description: 'Search for work items using text search',
    inputSchema: {
      type: 'object',
      properties: {
        searchText: {
          type: 'string',
          description: 'Search text',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
        top: {
          type: 'number',
          description: 'Number of results to retrieve (default 10)',
          default: 10,
        },
      },
      required: ['searchText'],
    },
  },
  {
    name: 'list_wikis',
    description: 'List wikis in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'get_wiki_page',
    description: 'Get content of a wiki page',
    inputSchema: {
      type: 'object',
      properties: {
        wikiIdentifier: {
          type: 'string',
          description: 'Wiki identifier (ID or name)',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
        path: {
          type: 'string',
          description: 'Wiki page path (default "/")',
          default: '/',
        },
      },
      required: ['wikiIdentifier'],
    },
  },
  {
    name: 'list_team_iterations',
    description: 'List iterations for a team',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        team: {
          type: 'string',
          description: 'Team name or ID',
        },
      },
      required: ['project', 'team'],
    },
  },
  {
    name: 'list_test_plans',
    description: 'List test plans in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
      },
      required: ['project'],
    },
  },
  {
    name: 'get_current_user',
    description: 'Get the currently authenticated user details',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_work_item_types',
    description: 'List work item types available in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_iterations',
    description: 'List iterations (sprints) for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_build_definitions',
    description: 'List build definitions (pipelines) for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_release_definitions',
    description: 'List release definitions for a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_queries',
    description: 'List saved work item queries in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'get_work_item_revisions',
    description: 'Get revision history of a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_work_item_links',
    description: 'Get links (relations) of a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'create_pull_request',
    description: 'Create a new pull request',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: 'Repository ID',
        },
        sourceBranch: {
          type: 'string',
          description: 'Source branch name (without refs/heads/)',
        },
        targetBranch: {
          type: 'string',
          description: 'Target branch name (without refs/heads/)',
        },
        title: {
          type: 'string',
          description: 'Pull request title',
        },
        description: {
          type: 'string',
          description: 'Optional description',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['repositoryId', 'sourceBranch', 'targetBranch', 'title'],
    },
  },
  {
    name: 'list_commits',
    description: 'List commits in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: 'Repository ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
        top: {
          type: 'number',
          description: 'Number of commits to retrieve (default 10)',
          default: 10,
        },
      },
      required: ['repositoryId'],
    },
  },
  {
    name: 'get_file_content',
    description: 'Get content of a file in a repository',
    inputSchema: {
      type: 'object',
      properties: {
        repositoryId: {
          type: 'string',
          description: 'Repository ID',
        },
        path: {
          type: 'string',
          description: 'File path within repository',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['repositoryId', 'path'],
    },
  },
  {
    name: 'list_areas',
    description: 'List areas (classification nodes) in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_iteration_capacities',
    description: 'Get capacity for a team iteration',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        team: {
          type: 'string',
          description: 'Team name or ID',
        },
        iterationId: {
          type: 'string',
          description: 'Iteration ID',
        },
      },
      required: ['project', 'team', 'iterationId'],
    },
  },
  {
    name: 'list_work_item_categories',
    description: 'List work item categories in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_dashboards',
    description: 'List dashboards in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_pipelines',
    description: 'List pipelines (YAML pipelines) in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_test_suites',
    description: 'List test suites in a test plan',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        planId: {
          type: 'number',
          description: 'Test plan ID',
        },
      },
      required: ['project', 'planId'],
    },
  },
  {
    name: 'list_variable_groups',
    description: 'List variable groups for pipelines',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_service_endpoints',
    description: 'List service endpoints (service connections)',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_tags',
    description: 'List tags in a project',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_team_members',
    description: 'List members of a team',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        team: {
          type: 'string',
          description: 'Team name or ID',
        },
      },
      required: ['project', 'team'],
    },
  },
  {
    name: 'list_boards',
    description: 'List boards (work item boards) for a team',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        team: {
          type: 'string',
          description: 'Team name or ID',
        },
      },
      required: ['project', 'team'],
    },
  },
  {
    name: 'list_board_columns',
    description: 'List columns of a board',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        team: {
          type: 'string',
          description: 'Team name or ID',
        },
        board: {
          type: 'string',
          description: 'Board ID or name',
        },
      },
      required: ['project', 'team', 'board'],
    },
  },
  {
    name: 'list_board_rows',
    description: 'List rows of a board',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        team: {
          type: 'string',
          description: 'Team name or ID',
        },
        board: {
          type: 'string',
          description: 'Board ID or name',
        },
      },
      required: ['project', 'team', 'board'],
    },
  },
  {
    name: 'list_work_item_states',
    description: 'List states for a work item type',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        workItemType: {
          type: 'string',
          description: 'Work item type (e.g., Bug, Task, User Story)',
        },
      },
      required: ['project', 'workItemType'],
    },
  },
  {
    name: 'list_work_item_fields',
    description: 'List work item fields (metadata)',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
    },
  },
  {
    name: 'list_work_item_updates',
    description: 'List updates (history) for a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_work_item_attachments',
    description: 'List attachments for a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_work_item_comments',
    description: 'List comments for a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_work_item_relations',
    description: 'List relations (links) for a work item',
    inputSchema: {
      type: 'object',
      properties: {
        id: {
          type: 'number',
          description: 'Work item ID',
        },
        project: {
          type: 'string',
          description: 'Optional project name or ID. If not provided, uses the default project.',
        },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_work_item_query_results',
    description: 'Run a saved query and get results',
    inputSchema: {
      type: 'object',
      properties: {
        project: {
          type: 'string',
          description: 'Project name or ID',
        },
        queryId: {
          type: 'string',
          description: 'Query ID (GUID) or path',
        },
      },
      required: ['project', 'queryId'],
    },
  },
];

// Handle ListTools request
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

// Handle CallTool request
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    switch (name) {
      case 'list_projects': {
        const projects = await azureClient.getProjects();
        if (projects.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No projects found.',
              },
            ],
          };
        }
        const table = projects.map(p => `| ${p.id} | ${p.name} | ${p.description || ''} | ${p.url} |`).join('\n');
        const formatted = `## Projects (${projects.length})\n| ID | Name | Description | URL |\n|----|------|-------------|-----|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'query_work_items': {
        const wiql = args?.wiql as string;
        if (!wiql) {
          throw new Error('wiql argument is required');
        }
        const workItems = await azureClient.queryWorkItems(wiql);
        if (workItems.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work items match the query.',
              },
            ],
          };
        }
        const table = workItems.map(wi => {
          const fields = wi.fields;
          return `| ${wi.id} | ${fields['System.Title'] || ''} | ${fields['System.State'] || ''} | ${fields['System.AssignedTo']?.displayName || ''} | ${fields['System.WorkItemType'] || ''} |`;
        }).join('\n');
        const formatted = `## Work Items (${workItems.length})\n| ID | Title | State | Assigned To | Type |\n|----|-------|-------|-------------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_work_items_by_ids': {
        const ids = args?.ids as number[];
        if (!ids || !Array.isArray(ids)) {
          throw new Error('ids argument must be an array of numbers');
        }
        const workItems = await azureClient.getWorkItems(ids);
        if (workItems.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work items found with those IDs.',
              },
            ],
          };
        }
        const table = workItems.map(wi => {
          const fields = wi.fields;
          return `| ${wi.id} | ${fields['System.Title'] || ''} | ${fields['System.State'] || ''} | ${fields['System.AssignedTo']?.displayName || ''} | ${fields['System.WorkItemType'] || ''} |`;
        }).join('\n');
        const formatted = `## Work Items (${workItems.length})\n| ID | Title | State | Assigned To | Type |\n|----|-------|-------|-------------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_builds': {
        const definitionId = args?.definitionId as number | undefined;
        const top = (args?.top as number) || 10;
        const builds = await azureClient.getBuilds(definitionId, top);
        if (builds.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No builds found.',
              },
            ],
          };
        }
        const table = builds.map(b => `| ${b.id} | ${b.buildNumber} | ${b.status} | ${b.result} | ${b.queueTime} | ${b.sourceBranch} |`).join('\n');
        const formatted = `## Builds (${builds.length})\n| ID | Build Number | Status | Result | Queue Time | Branch |\n|----|--------------|--------|--------|------------|--------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_releases': {
        const top = (args?.top as number) || 10;
        const releases = await azureClient.getReleases(top);
        if (releases.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No releases found.',
              },
            ],
          };
        }
        const table = releases.map(r => `| ${r.id} | ${r.name} | ${r.status} | ${r.createdOn} | ${r.modifiedOn} |`).join('\n');
        const formatted = `## Releases (${releases.length})\n| ID | Name | Status | Created | Modified |\n|----|------|--------|---------|----------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'create_work_item': {
        const workItemType = args?.workItemType as string;
        const title = args?.title as string;
        const description = args?.description as string | undefined;
        const additionalFields = args?.additionalFields as Record<string, any> | undefined;
        if (!workItemType || !title) {
          throw new Error('workItemType and title are required');
        }
        const workItem = await azureClient.createWorkItem(workItemType, title, description, additionalFields);
        const formatted = `✅ Work item created successfully!
**ID**: ${workItem.id}
**Type**: ${workItemType}
**Title**: ${title}
**URL**: ${workItem.url}
${description ? `**Description**: ${description}` : ''}
`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'update_work_item': {
        const id = args?.id as number;
        const fields = args?.fields as Record<string, any>;
        const comment = args?.comment as string | undefined;
        if (!id || !fields) {
          throw new Error('id and fields are required');
        }
        const workItem = await azureClient.updateWorkItem(id, fields, comment);
        const fieldList = Object.entries(fields).map(([key, val]) => `- **${key}**: ${val}`).join('\n');
        const formatted = `✅ Work item ${workItem.id} updated successfully!
**Updated fields**:
${fieldList}
${comment ? `**Comment**: ${comment}` : ''}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'assign_work_item': {
        const id = args?.id as number;
        const assignee = args?.assignee as string;
        const comment = args?.comment as string | undefined;
        if (!id || !assignee) {
          throw new Error('id and assignee are required');
        }
        const workItem = await azureClient.assignWorkItem(id, assignee, comment);
        const formatted = `✅ Work item ${workItem.id} assigned to ${assignee} successfully!
${comment ? `**Comment**: ${comment}` : ''}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_repositories': {
        const project = args?.project as string | undefined;
        const repos = await azureClient.getRepositories(project);
        if (repos.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No repositories found.',
              },
            ],
          };
        }
        const table = repos.map(r => `| ${r.id} | ${r.name} | ${r.isDisabled ? 'Disabled' : 'Active'} | ${r.isFork ? 'Fork' : 'No'} | ${r.webUrl} |`).join('\n');
        const formatted = `## Repositories (${repos.length})\n| ID | Name | Status | Fork | URL |\n|----|------|--------|------|-----|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_branches': {
        const repositoryId = args?.repositoryId as string;
        const project = args?.project as string | undefined;
        const branches = await azureClient.getBranches(repositoryId, project);
        if (branches.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No branches found.',
              },
            ],
          };
        }
        const table = branches.map(b => `| ${b.name} | ${b.objectId.substring(0, 8)} | ${b.creator?.displayName || ''} |`).join('\n');
        const formatted = `## Branches (${branches.length})\n| Name | Commit | Creator |\n|------|--------|---------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_pull_requests': {
        const repositoryId = args?.repositoryId as string | undefined;
        const project = args?.project as string | undefined;
        const top = (args?.top as number) || 100;
        const status = (args?.status as string) || 'active';
        const prs = await azureClient.getPullRequests(repositoryId, project, top, status);
        if (prs.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No pull requests found.',
              },
            ],
          };
        }
        const table = prs.map(pr => `| ${pr.pullRequestId} | ${pr.title} | ${pr.status} | ${pr.createdBy.displayName} | ${pr.creationDate} |`).join('\n');
        const formatted = `## Pull Requests (${prs.length})\n| ID | Title | Status | Created By | Created |\n|----|-------|--------|------------|---------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_pull_request': {
        const repositoryId = args?.repositoryId as string;
        const pullRequestId = args?.pullRequestId as number;
        const project = args?.project as string | undefined;
        const pr = await azureClient.getPullRequestById(repositoryId, pullRequestId, project);
        const formatted = `## Pull Request ${pr.pullRequestId}
**Title**: ${pr.title}
**Repository**: ${pr.repository.name}
**Status**: ${pr.status}
**Created By**: ${pr.createdBy.displayName} (${pr.createdBy.uniqueName})
**Created**: ${pr.creationDate}
**Source**: ${pr.sourceRefName}
**Target**: ${pr.targetRefName}
${pr.description ? `**Description**: ${pr.description}` : ''}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'search_code': {
        const searchText = args?.searchText as string;
        const project = args?.project as string | undefined;
        const repository = args?.repository as string | undefined;
        const top = (args?.top as number) || 5;
        const results = await azureClient.searchCode(searchText, project, repository, top);
        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No code search results found.',
              },
            ],
          };
        }
        const table = results.map((r: any) => `| ${r.project?.name || ''} | ${r.repository?.name || ''} | ${r.path || ''} | ${r.matches?.length || 0} matches |`).join('\n');
        const formatted = `## Code Search Results (${results.length})\n| Project | Repository | Path | Matches |\n|---------|------------|------|---------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'search_work_items': {
        const searchText = args?.searchText as string;
        const project = args?.project as string | undefined;
        const top = (args?.top as number) || 10;
        const results = await azureClient.searchWorkItems(searchText, project, top);
        if (results.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work item search results found.',
              },
            ],
          };
        }
        const table = results.map((r: any) => `| ${r.fields?.['System.Id'] || ''} | ${r.fields?.['System.Title'] || ''} | ${r.fields?.['System.State'] || ''} | ${r.fields?.['System.WorkItemType'] || ''} |`).join('\n');
        const formatted = `## Work Item Search Results (${results.length})\n| ID | Title | State | Type |\n|----|-------|-------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_wikis': {
        const project = args?.project as string | undefined;
        const wikis = await azureClient.getWikis(project);
        if (wikis.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No wikis found.',
              },
            ],
          };
        }
        const table = wikis.map(w => `| ${w.id} | ${w.name} | ${w.type} | ${w.projectId} |`).join('\n');
        const formatted = `## Wikis (${wikis.length})\n| ID | Name | Type | Project ID |\n|----|------|------|------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_wiki_page': {
        const wikiIdentifier = args?.wikiIdentifier as string;
        const project = args?.project as string | undefined;
        const path = (args?.path as string) || '/';
        const content = await azureClient.getWikiPageContent(wikiIdentifier, project, path);
        const formatted = `## Wiki Page: ${path}\n${content}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_team_iterations': {
        const project = args?.project as string;
        const team = args?.team as string;
        const iterations = await azureClient.getTeamIterations(project, team);
        if (iterations.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No iterations found for this team.',
              },
            ],
          };
        }
        const table = iterations.map(i => `| ${i.id} | ${i.name} | ${i.path} | ${i.attributes.startDate || ''} - ${i.attributes.finishDate || ''} |`).join('\n');
        const formatted = `## Iterations (${iterations.length})\n| ID | Name | Path | Dates |\n|----|------|------|-------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_test_plans': {
        const project = args?.project as string;
        const testPlans = await azureClient.getTestPlans(project);
        if (testPlans.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No test plans found.',
              },
            ],
          };
        }
        const table = testPlans.map(tp => `| ${tp.id} | ${tp.name} | ${tp.description || ''} | ${tp.areaPath || ''} | ${tp.iteration || ''} |`).join('\n');
        const formatted = `## Test Plans (${testPlans.length})\n| ID | Name | Description | Area Path | Iteration |\n|----|------|-------------|-----------|-----------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_project_teams': {
        const project = args?.project as string;
        const mine = args?.mine as boolean | undefined;
        const top = (args?.top as number) || 100;
        const skip = (args?.skip as number) || 0;
        const teams = await azureClient.getTeams(project, mine, top, skip);
        if (teams.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No teams found.',
              },
            ],
          };
        }
        const table = teams.map(t => `| ${t.id} | ${t.name} | ${t.description || ''} | ${t.projectName || ''} |`).join('\n');
        const formatted = `## Teams (${teams.length})\n| ID | Name | Description | Project |\n|----|------|-------------|---------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_identity_ids': {
        const searchFilter = args?.searchFilter as string;
        if (!searchFilter) {
          throw new Error('searchFilter argument is required');
        }
        const identities = await azureClient.searchIdentities(searchFilter);
        if (!identities || identities.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No identities found.',
              },
            ],
          };
        }
        const table = identities.map((id: any) => `| ${id.localId} | ${id.displayName} | ${id.uniqueName} | ${id.subjectDescriptor} |`).join('\n');
        const formatted = `## Identities (${identities.length})\n| Local ID | Display Name | Unique Name | Subject Descriptor |\n|----------|--------------|-------------|-------------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_current_user': {
        const user = await azureClient.getCurrentUser();
        const formatted = `## Current User
**ID**: ${user.id}
**Display Name**: ${user.displayName}
**Unique Name**: ${user.uniqueName}
**Email**: ${user.email || 'N/A'}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_types': {
        const project = args?.project as string | undefined;
        const types = await azureClient.getWorkItemTypes(project);
        if (types.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work item types found.',
              },
            ],
          };
        }
        const table = types.map(t => `| ${t.name} | ${t.referenceName} | ${t.description || ''} |`).join('\n');
        const formatted = `## Work Item Types (${types.length})\n| Name | Reference Name | Description |\n|------|----------------|-------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_iterations': {
        const project = args?.project as string | undefined;
        const iterations = await azureClient.getIterations(project);
        if (iterations.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No iterations found.',
              },
            ],
          };
        }
        const table = iterations.map(i => `| ${i.id} | ${i.name} | ${i.path} | ${i.attributes?.startDate || ''} - ${i.attributes?.finishDate || ''} |`).join('\n');
        const formatted = `## Iterations (${iterations.length})\n| ID | Name | Path | Dates |\n|----|------|------|-------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_build_definitions': {
        const project = args?.project as string | undefined;
        const definitions = await azureClient.getBuildDefinitions(project);
        if (definitions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No build definitions found.',
              },
            ],
          };
        }
        const table = definitions.map(d => `| ${d.id} | ${d.name} | ${d.path || ''} | ${d.queueStatus || ''} |`).join('\n');
        const formatted = `## Build Definitions (${definitions.length})\n| ID | Name | Path | Queue Status |\n|----|------|------|-------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_release_definitions': {
        const project = args?.project as string | undefined;
        const definitions = await azureClient.getReleaseDefinitions(project);
        if (definitions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No release definitions found.',
              },
            ],
          };
        }
        const table = definitions.map(d => `| ${d.id} | ${d.name} | ${d.path || ''} | ${d.releaseNameFormat || ''} |`).join('\n');
        const formatted = `## Release Definitions (${definitions.length})\n| ID | Name | Path | Release Name Format |\n|----|------|------|-------------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_queries': {
        const project = args?.project as string | undefined;
        const queries = await azureClient.getQueries(project);
        if (queries.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No queries found.',
              },
            ],
          };
        }
        const table = queries.map(q => `| ${q.id} | ${q.name} | ${q.path || ''} | ${q.isFolder ? 'Folder' : 'Query'} |`).join('\n');
        const formatted = `## Queries (${queries.length})\n| ID | Name | Path | Type |\n|----|------|------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_work_item_revisions': {
        const id = args?.id as number;
        const project = args?.project as string | undefined;
        if (!id) {
          throw new Error('id argument is required');
        }
        const revisions = await azureClient.getWorkItemRevisions(id, project);
        if (revisions.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No revisions found for this work item.',
              },
            ],
          };
        }
        const table = revisions.map((r: any) => `| ${r.rev} | ${r.fields?.['System.ChangedDate'] || ''} | ${r.fields?.['System.ChangedBy']?.displayName || ''} | ${r.fields?.['System.State'] || ''} |`).join('\n');
        const formatted = `## Work Item Revisions (${revisions.length})\n| Rev | Changed Date | Changed By | State |\n|-----|--------------|------------|-------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_work_item_links': {
        const id = args?.id as number;
        const project = args?.project as string | undefined;
        if (!id) {
          throw new Error('id argument is required');
        }
        const links = await azureClient.getWorkItemLinks(id, project);
        if (links.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No links found for this work item.',
              },
            ],
          };
        }
        const table = links.map((l: any) => `| ${l.rel} | ${l.url} | ${l.attributes?.name || ''} |`).join('\n');
        const formatted = `## Work Item Links (${links.length})\n| Relation | URL | Name |\n|----------|-----|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'create_pull_request': {
        const repositoryId = args?.repositoryId as string;
        const sourceBranch = args?.sourceBranch as string;
        const targetBranch = args?.targetBranch as string;
        const title = args?.title as string;
        const description = args?.description as string | undefined;
        const project = args?.project as string | undefined;
        if (!repositoryId || !sourceBranch || !targetBranch || !title) {
          throw new Error('repositoryId, sourceBranch, targetBranch, and title are required');
        }
        const pr = await azureClient.createPullRequest(repositoryId, sourceBranch, targetBranch, title, description, project);
        const formatted = `✅ Pull request created successfully!
**ID**: ${pr.pullRequestId}
**Title**: ${title}
**Repository**: ${pr.repository?.name || ''}
**Source**: ${sourceBranch}
**Target**: ${targetBranch}
**Status**: ${pr.status}
**URL**: ${pr.url || 'N/A'}
${description ? `**Description**: ${description}` : ''}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_commits': {
        const repositoryId = args?.repositoryId as string;
        const project = args?.project as string | undefined;
        const top = (args?.top as number) || 10;
        if (!repositoryId) {
          throw new Error('repositoryId argument is required');
        }
        const commits = await azureClient.getCommits(repositoryId, project, top);
        if (commits.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No commits found.',
              },
            ],
          };
        }
        const table = commits.map(c => `| ${c.commitId?.substring(0, 8) || ''} | ${c.author?.name || ''} | ${c.comment || ''} | ${c.committer?.date || ''} |`).join('\n');
        const formatted = `## Commits (${commits.length})\n| Commit | Author | Message | Date |\n|--------|--------|---------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'get_file_content': {
        const repositoryId = args?.repositoryId as string;
        const path = args?.path as string;
        const project = args?.project as string | undefined;
        if (!repositoryId || !path) {
          throw new Error('repositoryId and path are required');
        }
        const content = await azureClient.getFileContent(repositoryId, path, project);
        const formatted = `## File: ${path}\n\`\`\`\n${content}\n\`\`\``;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_areas': {
        const project = args?.project as string | undefined;
        const areas = await azureClient.getAreas(project);
        if (areas.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No areas found.',
              },
            ],
          };
        }
        const table = areas.map(a => `| ${a.id} | ${a.name} | ${a.path || ''} | ${a.structureType || ''} |`).join('\n');
        const formatted = `## Areas (${areas.length})\n| ID | Name | Path | Type |\n|----|------|------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_iteration_capacities': {
        const project = args?.project as string;
        const team = args?.team as string;
        const iterationId = args?.iterationId as string;
        if (!project || !team || !iterationId) {
          throw new Error('project, team, and iterationId are required');
        }
        const capacities = await azureClient.getIterationCapacities(project, team, iterationId);
        if (capacities.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No capacities found for this iteration.',
              },
            ],
          };
        }
        const table = capacities.map(c => `| ${c.teamMember?.displayName || ''} | ${c.activities?.map((a: any) => a.name).join(', ') || ''} | ${c.daysOff?.length || 0} days off |`).join('\n');
        const formatted = `## Iteration Capacities (${capacities.length})\n| Team Member | Activities | Days Off |\n|-------------|------------|----------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_categories': {
        const project = args?.project as string | undefined;
        const categories = await azureClient.getWorkItemCategories(project);
        if (categories.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work item categories found.',
              },
            ],
          };
        }
        const table = categories.map(c => `| ${c.name} | ${c.referenceName} | ${c.defaultWorkItemType?.name || ''} |`).join('\n');
        const formatted = `## Work Item Categories (${categories.length})\n| Name | Reference Name | Default Work Item Type |\n|------|----------------|------------------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_dashboards': {
        const project = args?.project as string | undefined;
        const dashboards = await azureClient.getDashboards(project);
        if (dashboards.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No dashboards found.',
              },
            ],
          };
        }
        const table = dashboards.map(d => `| ${d.id} | ${d.name} | ${d.description || ''} | ${d.modifiedDate || ''} |`).join('\n');
        const formatted = `## Dashboards (${dashboards.length})\n| ID | Name | Description | Modified |\n|----|------|-------------|----------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_pipelines': {
        const project = args?.project as string | undefined;
        const pipelines = await azureClient.getPipelines(project);
        if (pipelines.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No pipelines found.',
              },
            ],
          };
        }
        const table = pipelines.map(p => `| ${p.id} | ${p.name} | ${p.folder || ''} | ${p.revision || ''} |`).join('\n');
        const formatted = `## Pipelines (${pipelines.length})\n| ID | Name | Folder | Revision |\n|----|------|--------|----------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_test_suites': {
        const project = args?.project as string;
        const planId = args?.planId as number;
        if (!project || !planId) {
          throw new Error('project and planId are required');
        }
        const testSuites = await azureClient.getTestSuites(project, planId);
        if (testSuites.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No test suites found.',
              },
            ],
          };
        }
        const table = testSuites.map(ts => `| ${ts.id} | ${ts.name} | ${ts.testCaseCount || 0} test cases | ${ts.suiteType || ''} |`).join('\n');
        const formatted = `## Test Suites (${testSuites.length})\n| ID | Name | Test Cases | Type |\n|----|------|------------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_variable_groups': {
        const project = args?.project as string | undefined;
        const variableGroups = await azureClient.getVariableGroups(project);
        if (variableGroups.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No variable groups found.',
              },
            ],
          };
        }
        const table = variableGroups.map(vg => `| ${vg.id} | ${vg.name} | ${vg.description || ''} | ${vg.variableGroupProjectReferences?.[0]?.projectReference?.name || ''} |`).join('\n');
        const formatted = `## Variable Groups (${variableGroups.length})\n| ID | Name | Description | Project |\n|----|------|-------------|---------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_service_endpoints': {
        const project = args?.project as string | undefined;
        const serviceEndpoints = await azureClient.getServiceEndpoints(project);
        if (serviceEndpoints.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No service endpoints found.',
              },
            ],
          };
        }
        const table = serviceEndpoints.map(se => `| ${se.id} | ${se.name} | ${se.type || ''} | ${se.isReady ? 'Ready' : 'Not Ready'} |`).join('\n');
        const formatted = `## Service Endpoints (${serviceEndpoints.length})\n| ID | Name | Type | Status |\n|----|------|------|--------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_tags': {
        const project = args?.project as string | undefined;
        const tags = await azureClient.getTags(project);
        if (tags.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No tags found.',
              },
            ],
          };
        }
        const table = tags.map(t => `| ${t.id} | ${t.name} | ${t.active ? 'Active' : 'Inactive'} |`).join('\n');
        const formatted = `## Tags (${tags.length})\n| ID | Name | Status |\n|----|------|--------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_team_members': {
        const project = args?.project as string;
        const team = args?.team as string;
        if (!project || !team) {
          throw new Error('project and team are required');
        }
        const members = await azureClient.getTeamMembers(project, team);
        if (members.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No team members found.',
              },
            ],
          };
        }
        const table = members.map(m => `| ${m.identity?.displayName || ''} | ${m.identity?.uniqueName || ''} | ${m.identity?.id || ''} |`).join('\n');
        const formatted = `## Team Members (${members.length})\n| Display Name | Unique Name | ID |\n|--------------|-------------|----|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_boards': {
        const project = args?.project as string;
        const team = args?.team as string;
        if (!project || !team) {
          throw new Error('project and team are required');
        }
        const boards = await azureClient.getBoards(project, team);
        if (boards.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No boards found.',
              },
            ],
          };
        }
        const table = boards.map(b => `| ${b.id} | ${b.name} | ${b.description || ''} |`).join('\n');
        const formatted = `## Boards (${boards.length})\n| ID | Name | Description |\n|----|------|-------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_board_columns': {
        const project = args?.project as string;
        const team = args?.team as string;
        const board = args?.board as string;
        if (!project || !team || !board) {
          throw new Error('project, team, and board are required');
        }
        const columns = await azureClient.getBoardColumns(project, team, board);
        if (columns.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No board columns found.',
              },
            ],
          };
        }
        const table = columns.map(c => `| ${c.id} | ${c.name} | ${c.itemLimit || 'No limit'} | ${c.columnType || ''} |`).join('\n');
        const formatted = `## Board Columns (${columns.length})\n| ID | Name | Item Limit | Type |\n|----|------|------------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_board_rows': {
        const project = args?.project as string;
        const team = args?.team as string;
        const board = args?.board as string;
        if (!project || !team || !board) {
          throw new Error('project, team, and board are required');
        }
        const rows = await azureClient.getBoardRows(project, team, board);
        if (rows.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No board rows found.',
              },
            ],
          };
        }
        const table = rows.map(r => `| ${r.id} | ${r.name} | ${r.rank || ''} |`).join('\n');
        const formatted = `## Board Rows (${rows.length})\n| ID | Name | Rank |\n|----|------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_states': {
        const project = args?.project as string;
        const workItemType = args?.workItemType as string;
        if (!project || !workItemType) {
          throw new Error('project and workItemType are required');
        }
        const states = await azureClient.getWorkItemStates(project, workItemType);
        if (states.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work item states found.',
              },
            ],
          };
        }
        const table = states.map(s => `| ${s.name} | ${s.category || ''} | ${s.color || ''} | ${s.order || ''} |`).join('\n');
        const formatted = `## Work Item States (${states.length})\n| Name | Category | Color | Order |\n|------|----------|-------|-------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_fields': {
        const project = args?.project as string | undefined;
        const fields = await azureClient.getWorkItemFields(project);
        if (fields.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work item fields found.',
              },
            ],
          };
        }
        const table = fields.map(f => `| ${f.referenceName} | ${f.name} | ${f.type || ''} | ${f.readOnly ? 'Read-only' : 'Editable'} |`).join('\n');
        const formatted = `## Work Item Fields (${fields.length})\n| Reference Name | Name | Type | Access |\n|----------------|------|------|--------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_updates': {
        const id = args?.id as number;
        const project = args?.project as string | undefined;
        if (!id) {
          throw new Error('id is required');
        }
        const updates = await azureClient.getWorkItemUpdates(id, project);
        if (updates.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No updates found for this work item.',
              },
            ],
          };
        }
        const table = updates.map(u => `| ${u.id} | ${u.rev} | ${u.fields?.['System.ChangedDate'] || ''} | ${u.fields?.['System.ChangedBy']?.displayName || ''} |`).join('\n');
        const formatted = `## Work Item Updates (${updates.length})\n| Update ID | Revision | Changed Date | Changed By |\n|-----------|----------|--------------|------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_attachments': {
        const id = args?.id as number;
        const project = args?.project as string | undefined;
        if (!id) {
          throw new Error('id is required');
        }
        const attachments = await azureClient.getWorkItemAttachments(id, project);
        if (attachments.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No attachments found for this work item.',
              },
            ],
          };
        }
        const table = attachments.map(a => `| ${a.id} | ${a.name} | ${a.size || ''} | ${a.createdDate || ''} |`).join('\n');
        const formatted = `## Work Item Attachments (${attachments.length})\n| ID | Name | Size | Created Date |\n|----|------|------|--------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_comments': {
        const id = args?.id as number;
        const project = args?.project as string | undefined;
        if (!id) {
          throw new Error('id is required');
        }
        const comments = await azureClient.getWorkItemComments(id, project);
        if (comments.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No comments found for this work item.',
              },
            ],
          };
        }
        const table = comments.map(c => `| ${c.id} | ${c.text || ''} | ${c.createdBy?.displayName || ''} | ${c.createdDate || ''} |`).join('\n');
        const formatted = `## Work Item Comments (${comments.length})\n| ID | Text | Created By | Created Date |\n|----|------|------------|--------------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_relations': {
        const id = args?.id as number;
        const project = args?.project as string | undefined;
        if (!id) {
          throw new Error('id is required');
        }
        const relations = await azureClient.getWorkItemRelations(id, project);
        if (relations.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No relations found for this work item.',
              },
            ],
          };
        }
        const table = relations.map(r => `| ${r.rel} | ${r.url} | ${r.attributes?.name || ''} |`).join('\n');
        const formatted = `## Work Item Relations (${relations.length})\n| Relation | URL | Name |\n|----------|-----|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      case 'list_work_item_query_results': {
        const project = args?.project as string;
        const queryId = args?.queryId as string;
        if (!project || !queryId) {
          throw new Error('project and queryId are required');
        }
        const workItems = await azureClient.getQueryResults(project, queryId);
        if (workItems.length === 0) {
          return {
            content: [
              {
                type: 'text',
                text: 'No work items found for this query.',
              },
            ],
          };
        }
        const table = workItems.map(wi => {
          const fields = wi.fields;
          return `| ${wi.id} | ${fields['System.Title'] || ''} | ${fields['System.State'] || ''} | ${fields['System.AssignedTo']?.displayName || ''} | ${fields['System.WorkItemType'] || ''} |`;
        }).join('\n');
        const formatted = `## Query Results (${workItems.length})\n| ID | Title | State | Assigned To | Type |\n|----|-------|-------|-------------|------|\n${table}`;
        return {
          content: [
            {
              type: 'text',
              text: formatted,
            },
          ],
        };
      }
      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
      isError: true,
    };
  }
});

// Start HTTP API server for frontend
const startHttpServer = () => {
  const app = express();
  const port = process.env.PORT || 3001;

  app.use(cors());
  app.use(express.json());

  // Health check
  app.get('/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // List tools endpoint (for frontend)
  app.get('/api/tools', (req, res) => {
    res.json({ tools });
  });

  // Call tool endpoint (for frontend)
  app.post('/api/tools/:name', async (req, res) => {
    const { name } = req.params;
    const args = req.body;
    try {
      // Simulate MCP tool call
      const tool = tools.find(t => t.name === name);
      if (!tool) {
        return res.status(404).json({ error: 'Tool not found' });
      }
      // For simplicity, we directly call Azure DevOps client
      // In a real scenario, you'd reuse the same logic as above
      const azureClient = new AzureDevOpsClient();
      let rawResult;
      switch (name) {
        case 'list_projects':
          rawResult = await azureClient.getProjects();
          break;
        case 'query_work_items':
          rawResult = await azureClient.queryWorkItems(args.wiql);
          break;
        case 'get_work_items_by_ids':
          rawResult = await azureClient.getWorkItems(args.ids);
          break;
        case 'get_builds':
          rawResult = await azureClient.getBuilds(args.definitionId, args.top);
          break;
        case 'get_releases':
          rawResult = await azureClient.getReleases(args.top);
          break;
        case 'create_work_item':
          rawResult = await azureClient.createWorkItem(
            args.workItemType,
            args.title,
            args.description,
            args.additionalFields
          );
          break;
        case 'update_work_item':
          rawResult = await azureClient.updateWorkItem(
            args.id,
            args.fields,
            args.comment
          );
          break;
        case 'assign_work_item':
          rawResult = await azureClient.assignWorkItem(
            args.id,
            args.assignee,
            args.comment
          );
          break;
        case 'list_repositories':
          rawResult = await azureClient.getRepositories(args.project);
          break;
        case 'list_branches':
          rawResult = await azureClient.getBranches(args.repositoryId, args.project);
          break;
        case 'list_pull_requests':
          rawResult = await azureClient.getPullRequests(args.repositoryId, args.project, args.top, args.status);
          break;
        case 'get_pull_request':
          rawResult = await azureClient.getPullRequestById(args.repositoryId, args.pullRequestId, args.project);
          break;
        case 'search_code':
          rawResult = await azureClient.searchCode(args.searchText, args.project, args.repository, args.top);
          break;
        case 'search_work_items':
          rawResult = await azureClient.searchWorkItems(args.searchText, args.project, args.top);
          break;
        case 'list_wikis':
          rawResult = await azureClient.getWikis(args.project);
          break;
        case 'get_wiki_page':
          rawResult = await azureClient.getWikiPageContent(args.wikiIdentifier, args.project, args.path);
          break;
        case 'list_team_iterations':
          rawResult = await azureClient.getTeamIterations(args.project, args.team);
          break;
        case 'list_test_plans':
          rawResult = await azureClient.getTestPlans(args.project);
          break;
        case 'list_project_teams':
          rawResult = await azureClient.getTeams(args.project, args.mine, args.top, args.skip);
          break;
        case 'get_identity_ids':
          rawResult = await azureClient.searchIdentities(args.searchFilter);
          break;
        case 'get_current_user':
          rawResult = await azureClient.getCurrentUser();
          break;
        case 'list_work_item_types':
          rawResult = await azureClient.getWorkItemTypes(args.project);
          break;
        case 'list_iterations':
          rawResult = await azureClient.getIterations(args.project);
          break;
        case 'list_build_definitions':
          rawResult = await azureClient.getBuildDefinitions(args.project);
          break;
        case 'list_release_definitions':
          rawResult = await azureClient.getReleaseDefinitions(args.project);
          break;
        case 'list_queries':
          rawResult = await azureClient.getQueries(args.project);
          break;
        case 'get_work_item_revisions':
          rawResult = await azureClient.getWorkItemRevisions(args.id, args.project);
          break;
        case 'get_work_item_links':
          rawResult = await azureClient.getWorkItemLinks(args.id, args.project);
          break;
        case 'create_pull_request':
          rawResult = await azureClient.createPullRequest(args.repositoryId, args.sourceBranch, args.targetBranch, args.title, args.description, args.project);
          break;
        case 'list_commits':
          rawResult = await azureClient.getCommits(args.repositoryId, args.project, args.top);
          break;
        case 'get_file_content':
          rawResult = await azureClient.getFileContent(args.repositoryId, args.path, args.project);
          break;
        case 'list_areas':
          rawResult = await azureClient.getAreas(args.project);
          break;
        case 'list_iteration_capacities':
          rawResult = await azureClient.getIterationCapacities(args.project, args.team, args.iterationId);
          break;
        case 'list_work_item_categories':
          rawResult = await azureClient.getWorkItemCategories(args.project);
          break;
        case 'list_dashboards':
          rawResult = await azureClient.getDashboards(args.project);
          break;
        case 'list_pipelines':
          rawResult = await azureClient.getPipelines(args.project);
          break;
        case 'list_test_suites':
          rawResult = await azureClient.getTestSuites(args.project, args.planId);
          break;
        case 'list_variable_groups':
          rawResult = await azureClient.getVariableGroups(args.project);
          break;
        case 'list_service_endpoints':
          rawResult = await azureClient.getServiceEndpoints(args.project);
          break;
        case 'list_tags':
          rawResult = await azureClient.getTags(args.project);
          break;
        case 'list_team_members':
          rawResult = await azureClient.getTeamMembers(args.project, args.team);
          break;
        case 'list_boards':
          rawResult = await azureClient.getBoards(args.project, args.team);
          break;
        case 'list_board_columns':
          rawResult = await azureClient.getBoardColumns(args.project, args.team, args.board);
          break;
        case 'list_board_rows':
          rawResult = await azureClient.getBoardRows(args.project, args.team, args.board);
          break;
        case 'list_work_item_states':
          rawResult = await azureClient.getWorkItemStates(args.project, args.workItemType);
          break;
        case 'list_work_item_fields':
          rawResult = await azureClient.getWorkItemFields(args.project);
          break;
        case 'list_work_item_updates':
          rawResult = await azureClient.getWorkItemUpdates(args.id, args.project);
          break;
        case 'list_work_item_attachments':
          rawResult = await azureClient.getWorkItemAttachments(args.id, args.project);
          break;
        case 'list_work_item_comments':
          rawResult = await azureClient.getWorkItemComments(args.id, args.project);
          break;
        case 'list_work_item_relations':
          rawResult = await azureClient.getWorkItemRelations(args.id, args.project);
          break;
        case 'list_work_item_query_results':
          rawResult = await azureClient.getQueryResults(args.project, args.queryId);
          break;
        default:
          return res.status(400).json({ error: 'Unsupported tool' });
      }
      // Format the result
      let formatted;
      if (name === 'list_projects') {
        const projects = rawResult as any[];
        if (projects.length === 0) {
          formatted = 'No projects found.';
        } else {
          const table = projects.map(p => `| ${p.id} | ${p.name} | ${p.description || ''} | ${p.url} |`).join('\n');
          formatted = `## Projects (${projects.length})\n| ID | Name | Description | URL |\n|----|------|-------------|-----|\n${table}`;
        }
      } else if (name === 'query_work_items' || name === 'get_work_items_by_ids') {
        const workItems = rawResult as any[];
        if (workItems.length === 0) {
          formatted = 'No work items found.';
        } else {
          const table = workItems.map(wi => {
            const fields = wi.fields;
            return `| ${wi.id} | ${fields['System.Title'] || ''} | ${fields['System.State'] || ''} | ${fields['System.AssignedTo']?.displayName || ''} | ${fields['System.WorkItemType'] || ''} |`;
          }).join('\n');
          formatted = `## Work Items (${workItems.length})\n| ID | Title | State | Assigned To | Type |\n|----|-------|-------|-------------|------|\n${table}`;
        }
      } else if (name === 'get_builds') {
        const builds = rawResult as any[];
        if (builds.length === 0) {
          formatted = 'No builds found.';
        } else {
          const table = builds.map(b => `| ${b.id} | ${b.buildNumber} | ${b.status} | ${b.result} | ${b.queueTime} | ${b.sourceBranch} |`).join('\n');
          formatted = `## Builds (${builds.length})\n| ID | Build Number | Status | Result | Queue Time | Branch |\n|----|--------------|--------|--------|------------|--------|\n${table}`;
        }
      } else if (name === 'get_releases') {
        const releases = rawResult as any[];
        if (releases.length === 0) {
          formatted = 'No releases found.';
        } else {
          const table = releases.map(r => `| ${r.id} | ${r.name} | ${r.status} | ${r.createdOn} | ${r.modifiedOn} |`).join('\n');
          formatted = `## Releases (${releases.length})\n| ID | Name | Status | Created | Modified |\n|----|------|--------|---------|----------|\n${table}`;
        }
      } else if (name === 'create_work_item') {
        const workItem = rawResult as any;
        formatted = `✅ Work item created successfully!
**ID**: ${workItem.id}
**Type**: ${args.workItemType}
**Title**: ${args.title}
**URL**: ${workItem.url}
${args.description ? `**Description**: ${args.description}` : ''}`;
      } else if (name === 'update_work_item') {
        const workItem = rawResult as any;
        const fields = args.fields || {};
        const fieldList = Object.entries(fields).map(([key, val]) => `- **${key}**: ${val}`).join('\n');
        formatted = `✅ Work item ${workItem.id} updated successfully!
**Updated fields**:
${fieldList}
${args.comment ? `**Comment**: ${args.comment}` : ''}`;
      } else if (name === 'assign_work_item') {
        const workItem = rawResult as any;
        formatted = `✅ Work item ${workItem.id} assigned to ${args.assignee} successfully!
${args.comment ? `**Comment**: ${args.comment}` : ''}`;
      } else if (name === 'list_repositories') {
        const repos = rawResult as any[];
        if (repos.length === 0) {
          formatted = 'No repositories found.';
        } else {
          const table = repos.map(r => `| ${r.id} | ${r.name} | ${r.isDisabled ? 'Disabled' : 'Active'} | ${r.isFork ? 'Fork' : 'No'} | ${r.webUrl} |`).join('\n');
          formatted = `## Repositories (${repos.length})\n| ID | Name | Status | Fork | URL |\n|----|------|--------|------|-----|\n${table}`;
        }
      } else if (name === 'list_branches') {
        const branches = rawResult as any[];
        if (branches.length === 0) {
          formatted = 'No branches found.';
        } else {
          const table = branches.map(b => `| ${b.name} | ${b.objectId?.substring(0, 8) || ''} | ${b.creator?.displayName || ''} |`).join('\n');
          formatted = `## Branches (${branches.length})\n| Name | Commit | Creator |\n|------|--------|---------|\n${table}`;
        }
      } else if (name === 'list_pull_requests') {
        const prs = rawResult as any[];
        if (prs.length === 0) {
          formatted = 'No pull requests found.';
        } else {
          const table = prs.map(pr => `| ${pr.pullRequestId} | ${pr.title} | ${pr.status} | ${pr.createdBy?.displayName || ''} | ${pr.creationDate} |`).join('\n');
          formatted = `## Pull Requests (${prs.length})\n| ID | Title | Status | Created By | Created |\n|----|-------|--------|------------|---------|\n${table}`;
        }
      } else if (name === 'get_pull_request') {
        const pr = rawResult as any;
        formatted = `## Pull Request ${pr.pullRequestId}
**Title**: ${pr.title}
**Repository**: ${pr.repository?.name || ''}
**Status**: ${pr.status}
**Created By**: ${pr.createdBy?.displayName || ''} (${pr.createdBy?.uniqueName || ''})
**Created**: ${pr.creationDate}
**Source**: ${pr.sourceRefName}
**Target**: ${pr.targetRefName}
${pr.description ? `**Description**: ${pr.description}` : ''}`;
      } else if (name === 'search_code') {
        const results = rawResult as any[];
        if (results.length === 0) {
          formatted = 'No code search results found.';
        } else {
          const table = results.map(r => `| ${r.project?.name || ''} | ${r.repository?.name || ''} | ${r.path || ''} | ${r.matches?.length || 0} matches |`).join('\n');
          formatted = `## Code Search Results (${results.length})\n| Project | Repository | Path | Matches |\n|---------|------------|------|---------|\n${table}`;
        }
      } else if (name === 'search_work_items') {
        const results = rawResult as any[];
        if (results.length === 0) {
          formatted = 'No work item search results found.';
        } else {
          const table = results.map(r => `| ${r.fields?.['System.Id'] || ''} | ${r.fields?.['System.Title'] || ''} | ${r.fields?.['System.State'] || ''} | ${r.fields?.['System.WorkItemType'] || ''} |`).join('\n');
          formatted = `## Work Item Search Results (${results.length})\n| ID | Title | State | Type |\n|----|-------|-------|------|\n${table}`;
        }
      } else if (name === 'list_wikis') {
        const wikis = rawResult as any[];
        if (wikis.length === 0) {
          formatted = 'No wikis found.';
        } else {
          const table = wikis.map(w => `| ${w.id} | ${w.name} | ${w.type} | ${w.projectId} |`).join('\n');
          formatted = `## Wikis (${wikis.length})\n| ID | Name | Type | Project ID |\n|----|------|------|------------|\n${table}`;
        }
      } else if (name === 'get_wiki_page') {
        const content = rawResult as string;
        formatted = `## Wiki Page: ${args.path || '/'}\n${content}`;
      } else if (name === 'list_team_iterations') {
        const iterations = rawResult as any[];
        if (iterations.length === 0) {
          formatted = 'No iterations found for this team.';
        } else {
          const table = iterations.map(i => `| ${i.id} | ${i.name} | ${i.path} | ${i.attributes?.startDate || ''} - ${i.attributes?.finishDate || ''} |`).join('\n');
          formatted = `## Iterations (${iterations.length})\n| ID | Name | Path | Dates |\n|----|------|------|-------|\n${table}`;
        }
      } else if (name === 'list_test_plans') {
        const testPlans = rawResult as any[];
        if (testPlans.length === 0) {
          formatted = 'No test plans found.';
        } else {
          const table = testPlans.map(tp => `| ${tp.id} | ${tp.name} | ${tp.description || ''} | ${tp.areaPath || ''} | ${tp.iteration || ''} |`).join('\n');
          formatted = `## Test Plans (${testPlans.length})\n| ID | Name | Description | Area Path | Iteration |\n|----|------|-------------|-----------|-----------|\n${table}`;
        }
      } else if (name === 'list_project_teams') {
        const teams = rawResult as any[];
        if (teams.length === 0) {
          formatted = 'No teams found.';
        } else {
          const table = teams.map(t => `| ${t.id} | ${t.name} | ${t.description || ''} | ${t.projectName || ''} |`).join('\n');
          formatted = `## Teams (${teams.length})\n| ID | Name | Description | Project |\n|----|------|-------------|---------|\n${table}`;
        }
      } else if (name === 'get_identity_ids') {
        const identities = rawResult as any[];
        if (!identities || identities.length === 0) {
          formatted = 'No identities found.';
        } else {
          const table = identities.map((id: any) => `| ${id.localId} | ${id.displayName} | ${id.uniqueName} | ${id.subjectDescriptor} |`).join('\n');
          formatted = `## Identities (${identities.length})\n| Local ID | Display Name | Unique Name | Subject Descriptor |\n|----------|--------------|-------------|-------------------|\n${table}`;
        }
      } else if (name === 'get_current_user') {
        const user = rawResult as any;
        formatted = `## Current User
**ID**: ${user.id}
**Display Name**: ${user.displayName}
**Unique Name**: ${user.uniqueName}
**Email**: ${user.email || 'N/A'}`;
      } else if (name === 'list_work_item_types') {
        const types = rawResult as any[];
        if (types.length === 0) {
          formatted = 'No work item types found.';
        } else {
          const table = types.map(t => `| ${t.name} | ${t.referenceName} | ${t.description || ''} |`).join('\n');
          formatted = `## Work Item Types (${types.length})\n| Name | Reference Name | Description |\n|------|----------------|-------------|\n${table}`;
        }
      } else if (name === 'list_iterations') {
        const iterations = rawResult as any[];
        if (iterations.length === 0) {
          formatted = 'No iterations found.';
        } else {
          const table = iterations.map(i => `| ${i.id} | ${i.name} | ${i.path} | ${i.attributes?.startDate || ''} - ${i.attributes?.finishDate || ''} |`).join('\n');
          formatted = `## Iterations (${iterations.length})\n| ID | Name | Path | Dates |\n|----|------|------|-------|\n${table}`;
        }
      } else if (name === 'list_build_definitions') {
        const definitions = rawResult as any[];
        if (definitions.length === 0) {
          formatted = 'No build definitions found.';
        } else {
          const table = definitions.map(d => `| ${d.id} | ${d.name} | ${d.path || ''} | ${d.queueStatus || ''} |`).join('\n');
          formatted = `## Build Definitions (${definitions.length})\n| ID | Name | Path | Queue Status |\n|----|------|------|-------------|\n${table}`;
        }
      } else if (name === 'list_release_definitions') {
        const definitions = rawResult as any[];
        if (definitions.length === 0) {
          formatted = 'No release definitions found.';
        } else {
          const table = definitions.map(d => `| ${d.id} | ${d.name} | ${d.path || ''} | ${d.releaseNameFormat || ''} |`).join('\n');
          formatted = `## Release Definitions (${definitions.length})\n| ID | Name | Path | Release Name Format |\n|----|------|------|-------------------|\n${table}`;
        }
      } else if (name === 'list_queries') {
        const queries = rawResult as any[];
        if (queries.length === 0) {
          formatted = 'No queries found.';
        } else {
          const table = queries.map(q => `| ${q.id} | ${q.name} | ${q.path || ''} | ${q.isFolder ? 'Folder' : 'Query'} |`).join('\n');
          formatted = `## Queries (${queries.length})\n| ID | Name | Path | Type |\n|----|------|------|------|\n${table}`;
        }
      } else if (name === 'get_work_item_revisions') {
        const revisions = rawResult as any[];
        if (revisions.length === 0) {
          formatted = 'No revisions found for this work item.';
        } else {
          const table = revisions.map((r: any) => `| ${r.rev} | ${r.fields?.['System.ChangedDate'] || ''} | ${r.fields?.['System.ChangedBy']?.displayName || ''} | ${r.fields?.['System.State'] || ''} |`).join('\n');
          formatted = `## Work Item Revisions (${revisions.length})\n| Rev | Changed Date | Changed By | State |\n|-----|--------------|------------|-------|\n${table}`;
        }
      } else if (name === 'get_work_item_links') {
        const links = rawResult as any[];
        if (links.length === 0) {
          formatted = 'No links found for this work item.';
        } else {
          const table = links.map((l: any) => `| ${l.rel} | ${l.url} | ${l.attributes?.name || ''} |`).join('\n');
          formatted = `## Work Item Links (${links.length})\n| Relation | URL | Name |\n|----------|-----|------|\n${table}`;
        }
      } else if (name === 'create_pull_request') {
        const pr = rawResult as any;
        formatted = `✅ Pull request created successfully!
**ID**: ${pr.pullRequestId}
**Title**: ${args.title}
**Repository**: ${pr.repository?.name || ''}
**Source**: ${args.sourceBranch}
**Target**: ${args.targetBranch}
**Status**: ${pr.status}
**URL**: ${pr.url || 'N/A'}
${args.description ? `**Description**: ${args.description}` : ''}`;
      } else if (name === 'list_commits') {
        const commits = rawResult as any[];
        if (commits.length === 0) {
          formatted = 'No commits found.';
        } else {
          const table = commits.map(c => `| ${c.commitId?.substring(0, 8) || ''} | ${c.author?.name || ''} | ${c.comment || ''} | ${c.committer?.date || ''} |`).join('\n');
          formatted = `## Commits (${commits.length})\n| Commit | Author | Message | Date |\n|--------|--------|---------|------|\n${table}`;
        }
      } else if (name === 'get_file_content') {
        const content = rawResult as string;
        formatted = `## File: ${args.path}\n\`\`\`\n${content}\n\`\`\``;
      } else {
        formatted = JSON.stringify(rawResult, null, 2);
      }
      res.json({ result: formatted, raw: rawResult });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Chat completion endpoint with OpenAI function calling
  app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    try {
      // Convert MCP tools to OpenAI function definitions
      const functions = tools.map(tool => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      }));

      const response = await openai.chat.completions.create({
        model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
        messages: [
          {
            role: 'system',
            content: 'You are an assistant that helps users query and manage Azure DevOps. Use the provided functions to retrieve data, create work items, update work items (including fields like System.Description, System.Title, etc.), and manage builds/releases. When the user asks to create a work item, call the create_work_item function with workItemType and title. The project is already configured, so you do not need to ask for it. If the user mentions a project name, assume it matches the default project. When the user asks to list work items in a project, use the query_work_items function with a WIQL that selects all work items from that project (e.g., SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = \'terraform-modules\'). If the user asks something that cannot be answered with the available tools, respond politely.\n\nImportant mapping for update_work_item: When the user asks to update a field like "description", map it to System.Description in the fields object. Do NOT put the new value in the comment parameter. The comment parameter is only for adding a comment to the work item history, not for updating fields. If the user does not explicitly ask to add a comment, leave the comment parameter empty.',
          },
          { role: 'user', content: message },
        ],
        functions,
        function_call: 'auto',
      });

      const choice = response.choices[0];
      if (!choice.message) {
        return res.status(500).json({ error: 'No response from OpenAI' });
      }

      // If OpenAI wants to call a function
      if (choice.message.function_call) {
        const functionName = choice.message.function_call.name;
        let functionArgs;
        try {
          functionArgs = JSON.parse(choice.message.function_call.arguments || '{}');
        } catch (e) {
          functionArgs = {};
        }

        // Call the corresponding tool
        const azureClient = new AzureDevOpsClient();
        let rawResult;
        switch (functionName) {
          case 'list_projects':
            rawResult = await azureClient.getProjects();
            break;
          case 'query_work_items':
            rawResult = await azureClient.queryWorkItems(functionArgs.wiql);
            break;
          case 'get_work_items_by_ids':
            rawResult = await azureClient.getWorkItems(functionArgs.ids);
            break;
          case 'get_builds':
            rawResult = await azureClient.getBuilds(functionArgs.definitionId, functionArgs.top);
            break;
          case 'get_releases':
            rawResult = await azureClient.getReleases(functionArgs.top);
            break;
          case 'create_work_item':
            rawResult = await azureClient.createWorkItem(
              functionArgs.workItemType,
              functionArgs.title,
              functionArgs.description,
              functionArgs.additionalFields
            );
            break;
          case 'update_work_item':
            const fields = functionArgs.fields || {};
            const safeFields = typeof fields === 'object' && fields !== null ? fields : {};
            rawResult = await azureClient.updateWorkItem(
              functionArgs.id,
              safeFields,
              functionArgs.comment
            );
            break;
          case 'assign_work_item':
            rawResult = await azureClient.assignWorkItem(
              functionArgs.id,
              functionArgs.assignee,
              functionArgs.comment
            );
            break;
          case 'list_repositories':
            rawResult = await azureClient.getRepositories(functionArgs.project);
            break;
          case 'list_branches':
            rawResult = await azureClient.getBranches(functionArgs.repositoryId, functionArgs.project);
            break;
          case 'list_pull_requests':
            rawResult = await azureClient.getPullRequests(functionArgs.repositoryId, functionArgs.project, functionArgs.top, functionArgs.status);
            break;
          case 'get_pull_request':
            rawResult = await azureClient.getPullRequestById(functionArgs.repositoryId, functionArgs.pullRequestId, functionArgs.project);
            break;
          case 'search_code':
            rawResult = await azureClient.searchCode(functionArgs.searchText, functionArgs.project, functionArgs.repository, functionArgs.top);
            break;
          case 'search_work_items':
            rawResult = await azureClient.searchWorkItems(functionArgs.searchText, functionArgs.project, functionArgs.top);
            break;
          case 'list_wikis':
            rawResult = await azureClient.getWikis(functionArgs.project);
            break;
          case 'get_wiki_page':
            rawResult = await azureClient.getWikiPageContent(functionArgs.wikiIdentifier, functionArgs.project, functionArgs.path);
            break;
          case 'list_team_iterations':
            rawResult = await azureClient.getTeamIterations(functionArgs.project, functionArgs.team);
            break;
          case 'list_test_plans':
            rawResult = await azureClient.getTestPlans(functionArgs.project);
            break;
          case 'list_project_teams':
            rawResult = await azureClient.getTeams(functionArgs.project, functionArgs.mine, functionArgs.top, functionArgs.skip);
            break;
          case 'get_identity_ids':
            rawResult = await azureClient.searchIdentities(functionArgs.searchFilter);
            break;
          case 'get_current_user':
            rawResult = await azureClient.getCurrentUser();
            break;
          case 'list_work_item_types':
            rawResult = await azureClient.getWorkItemTypes(functionArgs.project);
            break;
          case 'list_iterations':
            rawResult = await azureClient.getIterations(functionArgs.project);
            break;
          case 'list_build_definitions':
            rawResult = await azureClient.getBuildDefinitions(functionArgs.project);
            break;
          case 'list_release_definitions':
            rawResult = await azureClient.getReleaseDefinitions(functionArgs.project);
            break;
          case 'list_queries':
            rawResult = await azureClient.getQueries(functionArgs.project);
            break;
          case 'get_work_item_revisions':
            rawResult = await azureClient.getWorkItemRevisions(functionArgs.id, functionArgs.project);
            break;
          case 'get_work_item_links':
            rawResult = await azureClient.getWorkItemLinks(functionArgs.id, functionArgs.project);
            break;
          case 'create_pull_request':
            rawResult = await azureClient.createPullRequest(functionArgs.repositoryId, functionArgs.sourceBranch, functionArgs.targetBranch, functionArgs.title, functionArgs.description, functionArgs.project);
            break;
          case 'list_commits':
            rawResult = await azureClient.getCommits(functionArgs.repositoryId, functionArgs.project, functionArgs.top);
            break;
          case 'get_file_content':
            rawResult = await azureClient.getFileContent(functionArgs.repositoryId, functionArgs.path, functionArgs.project);
            break;
          case 'list_areas':
            rawResult = await azureClient.getAreas(functionArgs.project);
            break;
          case 'list_iteration_capacities':
            rawResult = await azureClient.getIterationCapacities(functionArgs.project, functionArgs.team, functionArgs.iterationId);
            break;
          case 'list_work_item_categories':
            rawResult = await azureClient.getWorkItemCategories(functionArgs.project);
            break;
          case 'list_dashboards':
            rawResult = await azureClient.getDashboards(functionArgs.project);
            break;
          case 'list_pipelines':
            rawResult = await azureClient.getPipelines(functionArgs.project);
            break;
          case 'list_test_suites':
            rawResult = await azureClient.getTestSuites(functionArgs.project, functionArgs.planId);
            break;
          case 'list_variable_groups':
            rawResult = await azureClient.getVariableGroups(functionArgs.project);
            break;
          case 'list_service_endpoints':
            rawResult = await azureClient.getServiceEndpoints(functionArgs.project);
            break;
          case 'list_tags':
            rawResult = await azureClient.getTags(functionArgs.project);
            break;
          case 'list_team_members':
            rawResult = await azureClient.getTeamMembers(functionArgs.project, functionArgs.team);
            break;
          case 'list_boards':
            rawResult = await azureClient.getBoards(functionArgs.project, functionArgs.team);
            break;
          case 'list_board_columns':
            rawResult = await azureClient.getBoardColumns(functionArgs.project, functionArgs.team, functionArgs.board);
            break;
          case 'list_board_rows':
            rawResult = await azureClient.getBoardRows(functionArgs.project, functionArgs.team, functionArgs.board);
            break;
          case 'list_work_item_states':
            rawResult = await azureClient.getWorkItemStates(functionArgs.project, functionArgs.workItemType);
            break;
          case 'list_work_item_fields':
            rawResult = await azureClient.getWorkItemFields(functionArgs.project);
            break;
          case 'list_work_item_updates':
            rawResult = await azureClient.getWorkItemUpdates(functionArgs.id, functionArgs.project);
            break;
          case 'list_work_item_attachments':
            rawResult = await azureClient.getWorkItemAttachments(functionArgs.id, functionArgs.project);
            break;
          case 'list_work_item_comments':
            rawResult = await azureClient.getWorkItemComments(functionArgs.id, functionArgs.project);
            break;
          case 'list_work_item_relations':
            rawResult = await azureClient.getWorkItemRelations(functionArgs.id, functionArgs.project);
            break;
          case 'list_work_item_query_results':
            rawResult = await azureClient.getQueryResults(functionArgs.project, functionArgs.queryId);
            break;
          default:
            return res.status(400).json({ error: `Unknown function: ${functionName}` });
        }

        // Format the result
        let formatted;
        if (functionName === 'list_projects') {
          const projects = rawResult as any[];
          if (projects.length === 0) {
            formatted = 'No projects found.';
          } else {
            const table = projects.map(p => `| ${p.id} | ${p.name} | ${p.description || ''} | ${p.url} |`).join('\n');
            formatted = `## Projects (${projects.length})\n| ID | Name | Description | URL |\n|----|------|-------------|-----|\n${table}`;
          }
        } else if (functionName === 'query_work_items' || functionName === 'get_work_items_by_ids') {
          const workItems = rawResult as any[];
          if (workItems.length === 0) {
            formatted = 'No work items found.';
          } else {
            const table = workItems.map(wi => {
              const fields = wi.fields;
              return `| ${wi.id} | ${fields['System.Title'] || ''} | ${fields['System.State'] || ''} | ${fields['System.AssignedTo']?.displayName || ''} | ${fields['System.WorkItemType'] || ''} |`;
            }).join('\n');
            formatted = `## Work Items (${workItems.length})\n| ID | Title | State | Assigned To | Type |\n|----|-------|-------|-------------|------|\n${table}`;
          }
        } else if (functionName === 'get_builds') {
          const builds = rawResult as any[];
          if (builds.length === 0) {
            formatted = 'No builds found.';
          } else {
            const table = builds.map(b => `| ${b.id} | ${b.buildNumber} | ${b.status} | ${b.result} | ${b.queueTime} | ${b.sourceBranch} |`).join('\n');
            formatted = `## Builds (${builds.length})\n| ID | Build Number | Status | Result | Queue Time | Branch |\n|----|--------------|--------|--------|------------|--------|\n${table}`;
          }
        } else if (functionName === 'get_releases') {
          const releases = rawResult as any[];
          if (releases.length === 0) {
            formatted = 'No releases found.';
          } else {
            const table = releases.map(r => `| ${r.id} | ${r.name} | ${r.status} | ${r.createdOn} | ${r.modifiedOn} |`).join('\n');
            formatted = `## Releases (${releases.length})\n| ID | Name | Status | Created | Modified |\n|----|------|--------|---------|----------|\n${table}`;
          }
        } else if (functionName === 'create_work_item') {
          const workItem = rawResult as any;
          formatted = `✅ Work item created successfully!
**ID**: ${workItem.id}
**Type**: ${functionArgs.workItemType}
**Title**: ${functionArgs.title}
**URL**: ${workItem.url}
${functionArgs.description ? `**Description**: ${functionArgs.description}` : ''}`;
        } else if (functionName === 'update_work_item') {
          const workItem = rawResult as any;
          const fields = functionArgs.fields || {};
          // Ensure fields is an object
          const safeFields = typeof fields === 'object' && fields !== null ? fields : {};
          const fieldList = Object.entries(safeFields).map(([key, val]) => `- **${key}**: ${val}`).join('\n');
          formatted = `✅ Work item ${workItem.id} updated successfully!
**Updated fields**:
${fieldList}
${functionArgs.comment ? `**Comment**: ${functionArgs.comment}` : ''}`;
        } else if (functionName === 'assign_work_item') {
          const workItem = rawResult as any;
          formatted = `✅ Work item ${workItem.id} assigned to ${functionArgs.assignee} successfully!
${functionArgs.comment ? `**Comment**: ${functionArgs.comment}` : ''}`;
        } else if (functionName === 'list_repositories') {
          const repos = rawResult as any[];
          if (repos.length === 0) {
            formatted = 'No repositories found.';
          } else {
            const table = repos.map(r => `| ${r.id} | ${r.name} | ${r.isDisabled ? 'Disabled' : 'Active'} | ${r.isFork ? 'Fork' : 'No'} | ${r.webUrl} |`).join('\n');
            formatted = `## Repositories (${repos.length})\n| ID | Name | Status | Fork | URL |\n|----|------|--------|------|-----|\n${table}`;
          }
        } else if (functionName === 'list_branches') {
          const branches = rawResult as any[];
          if (branches.length === 0) {
            formatted = 'No branches found.';
          } else {
            const table = branches.map(b => `| ${b.name} | ${b.objectId?.substring(0, 8) || ''} | ${b.creator?.displayName || ''} |`).join('\n');
            formatted = `## Branches (${branches.length})\n| Name | Commit | Creator |\n|------|--------|---------|\n${table}`;
          }
        } else if (functionName === 'list_pull_requests') {
          const prs = rawResult as any[];
          if (prs.length === 0) {
            formatted = 'No pull requests found.';
          } else {
            const table = prs.map(pr => `| ${pr.pullRequestId} | ${pr.title} | ${pr.status} | ${pr.createdBy?.displayName || ''} | ${pr.creationDate} |`).join('\n');
            formatted = `## Pull Requests (${prs.length})\n| ID | Title | Status | Created By | Created |\n|----|-------|--------|------------|---------|\n${table}`;
          }
        } else if (functionName === 'get_pull_request') {
          const pr = rawResult as any;
          formatted = `## Pull Request ${pr.pullRequestId}
**Title**: ${pr.title}
**Repository**: ${pr.repository?.name || ''}
**Status**: ${pr.status}
**Created By**: ${pr.createdBy?.displayName || ''} (${pr.createdBy?.uniqueName || ''})
**Created**: ${pr.creationDate}
**Source**: ${pr.sourceRefName}
**Target**: ${pr.targetRefName}
${pr.description ? `**Description**: ${pr.description}` : ''}`;
        } else if (functionName === 'search_code') {
          const results = rawResult as any[];
          if (results.length === 0) {
            formatted = 'No code search results found.';
          } else {
            const table = results.map(r => `| ${r.project?.name || ''} | ${r.repository?.name || ''} | ${r.path || ''} | ${r.matches?.length || 0} matches |`).join('\n');
            formatted = `## Code Search Results (${results.length})\n| Project | Repository | Path | Matches |\n|---------|------------|------|---------|\n${table}`;
          }
        } else if (functionName === 'search_work_items') {
          const results = rawResult as any[];
          if (results.length === 0) {
            formatted = 'No work item search results found.';
          } else {
            const table = results.map(r => `| ${r.fields?.['System.Id'] || ''} | ${r.fields?.['System.Title'] || ''} | ${r.fields?.['System.State'] || ''} | ${r.fields?.['System.WorkItemType'] || ''} |`).join('\n');
            formatted = `## Work Item Search Results (${results.length})\n| ID | Title | State | Type |\n|----|-------|-------|------|\n${table}`;
          }
        } else if (functionName === 'list_wikis') {
          const wikis = rawResult as any[];
          if (wikis.length === 0) {
            formatted = 'No wikis found.';
          } else {
            const table = wikis.map(w => `| ${w.id} | ${w.name} | ${w.type} | ${w.projectId} |`).join('\n');
            formatted = `## Wikis (${wikis.length})\n| ID | Name | Type | Project ID |\n|----|------|------|------------|\n${table}`;
          }
        } else if (functionName === 'get_wiki_page') {
          const content = rawResult as string;
          formatted = `## Wiki Page: ${functionArgs.path || '/'}\n${content}`;
        } else if (functionName === 'list_team_iterations') {
          const iterations = rawResult as any[];
          if (iterations.length === 0) {
            formatted = 'No iterations found for this team.';
          } else {
            const table = iterations.map(i => `| ${i.id} | ${i.name} | ${i.path} | ${i.attributes?.startDate || ''} - ${i.attributes?.finishDate || ''} |`).join('\n');
            formatted = `## Iterations (${iterations.length})\n| ID | Name | Path | Dates |\n|----|------|------|-------|\n${table}`;
          }
        } else if (functionName === 'list_test_plans') {
          const testPlans = rawResult as any[];
          if (testPlans.length === 0) {
            formatted = 'No test plans found.';
          } else {
            const table = testPlans.map(tp => `| ${tp.id} | ${tp.name} | ${tp.description || ''} | ${tp.areaPath || ''} | ${tp.iteration || ''} |`).join('\n');
            formatted = `## Test Plans (${testPlans.length})\n| ID | Name | Description | Area Path | Iteration |\n|----|------|-------------|-----------|-----------|\n${table}`;
          }
        } else if (functionName === 'list_project_teams') {
          const teams = rawResult as any[];
          if (teams.length === 0) {
            formatted = 'No teams found.';
          } else {
            const table = teams.map(t => `| ${t.id} | ${t.name} | ${t.description || ''} | ${t.projectName || ''} |`).join('\n');
            formatted = `## Teams (${teams.length})\n| ID | Name | Description | Project |\n|----|------|-------------|---------|\n${table}`;
          }
        } else if (functionName === 'get_identity_ids') {
          const identities = rawResult as any[];
          if (!identities || identities.length === 0) {
            formatted = 'No identities found.';
          } else {
            const table = identities.map((id: any) => `| ${id.localId} | ${id.displayName} | ${id.uniqueName} | ${id.subjectDescriptor} |`).join('\n');
            formatted = `## Identities (${identities.length})\n| Local ID | Display Name | Unique Name | Subject Descriptor |\n|----------|--------------|-------------|-------------------|\n${table}`;
          }
        } else if (functionName === 'get_current_user') {
          const user = rawResult as any;
          formatted = `## Current User
**ID**: ${user.id}
**Display Name**: ${user.displayName}
**Unique Name**: ${user.uniqueName}
**Email**: ${user.email || 'N/A'}`;
        } else if (functionName === 'list_work_item_types') {
          const types = rawResult as any[];
          if (types.length === 0) {
            formatted = 'No work item types found.';
          } else {
            const table = types.map(t => `| ${t.name} | ${t.referenceName} | ${t.description || ''} |`).join('\n');
            formatted = `## Work Item Types (${types.length})\n| Name | Reference Name | Description |\n|------|----------------|-------------|\n${table}`;
          }
        } else if (functionName === 'list_iterations') {
          const iterations = rawResult as any[];
          if (iterations.length === 0) {
            formatted = 'No iterations found.';
          } else {
            const table = iterations.map(i => `| ${i.id} | ${i.name} | ${i.path} | ${i.attributes?.startDate || ''} - ${i.attributes?.finishDate || ''} |`).join('\n');
            formatted = `## Iterations (${iterations.length})\n| ID | Name | Path | Dates |\n|----|------|------|-------|\n${table}`;
          }
        } else if (functionName === 'list_build_definitions') {
          const definitions = rawResult as any[];
          if (definitions.length === 0) {
            formatted = 'No build definitions found.';
          } else {
            const table = definitions.map(d => `| ${d.id} | ${d.name} | ${d.path || ''} | ${d.queueStatus || ''} |`).join('\n');
            formatted = `## Build Definitions (${definitions.length})\n| ID | Name | Path | Queue Status |\n|----|------|------|-------------|\n${table}`;
          }
        } else if (functionName === 'list_release_definitions') {
          const definitions = rawResult as any[];
          if (definitions.length === 0) {
            formatted = 'No release definitions found.';
          } else {
            const table = definitions.map(d => `| ${d.id} | ${d.name} | ${d.path || ''} | ${d.releaseNameFormat || ''} |`).join('\n');
            formatted = `## Release Definitions (${definitions.length})\n| ID | Name | Path | Release Name Format |\n|----|------|------|-------------------|\n${table}`;
          }
        } else if (functionName === 'list_queries') {
          const queries = rawResult as any[];
          if (queries.length === 0) {
            formatted = 'No queries found.';
          } else {
            const table = queries.map(q => `| ${q.id} | ${q.name} | ${q.path || ''} | ${q.isFolder ? 'Folder' : 'Query'} |`).join('\n');
            formatted = `## Queries (${queries.length})\n| ID | Name | Path | Type |\n|----|------|------|------|\n${table}`;
          }
        } else if (functionName === 'get_work_item_revisions') {
          const revisions = rawResult as any[];
          if (revisions.length === 0) {
            formatted = 'No revisions found for this work item.';
          } else {
            const table = revisions.map((r: any) => `| ${r.rev} | ${r.fields?.['System.ChangedDate'] || ''} | ${r.fields?.['System.ChangedBy']?.displayName || ''} | ${r.fields?.['System.State'] || ''} |`).join('\n');
            formatted = `## Work Item Revisions (${revisions.length})\n| Rev | Changed Date | Changed By | State |\n|-----|--------------|------------|-------|\n${table}`;
          }
        } else if (functionName === 'get_work_item_links') {
          const links = rawResult as any[];
          if (links.length === 0) {
            formatted = 'No links found for this work item.';
          } else {
            const table = links.map((l: any) => `| ${l.rel} | ${l.url} | ${l.attributes?.name || ''} |`).join('\n');
            formatted = `## Work Item Links (${links.length})\n| Relation | URL | Name |\n|----------|-----|------|\n${table}`;
          }
        } else if (functionName === 'create_pull_request') {
          const pr = rawResult as any;
          formatted = `✅ Pull request created successfully!
**ID**: ${pr.pullRequestId}
**Title**: ${functionArgs.title}
**Repository**: ${pr.repository?.name || ''}
**Source**: ${functionArgs.sourceBranch}
**Target**: ${functionArgs.targetBranch}
**Status**: ${pr.status}
**URL**: ${pr.url || 'N/A'}
${functionArgs.description ? `**Description**: ${functionArgs.description}` : ''}`;
        } else if (functionName === 'list_commits') {
          const commits = rawResult as any[];
          if (commits.length === 0) {
            formatted = 'No commits found.';
          } else {
            const table = commits.map(c => `| ${c.commitId?.substring(0, 8) || ''} | ${c.author?.name || ''} | ${c.comment || ''} | ${c.committer?.date || ''} |`).join('\n');
            formatted = `## Commits (${commits.length})\n| Commit | Author | Message | Date |\n|--------|--------|---------|------|\n${table}`;
          }
        } else if (functionName === 'get_file_content') {
          const content = rawResult as string;
          formatted = `## File: ${functionArgs.path}\n\`\`\`\n${content}\n\`\`\``;
        } else {
          formatted = JSON.stringify(rawResult, null, 2);
        }

        // Get a final response from OpenAI with the formatted result
        const secondResponse = await openai.chat.completions.create({
          model: process.env.AZURE_OPENAI_DEPLOYMENT_NAME!,
          messages: [
            {
              role: 'system',
              content: 'You are an assistant that helps users query Azure DevOps. Use the provided functions to retrieve data, create work items, update work items, and manage builds/releases. The project is already configured, so you do not need to ask for it. When the user asks to list work items in a project, use the query_work_items function with a WIQL that selects all work items from that project (e.g., SELECT [System.Id] FROM WorkItems WHERE [System.TeamProject] = \'terraform-modules\'). If the user asks something that cannot be answered with the available tools, respond politely.\n\nImportant mapping for update_work_item: When the user asks to update a field like "description", map it to System.Description in the fields object. Do NOT put the new value in the comment parameter. The comment parameter is only for adding a comment to the work item history, not for updating fields. If the user does not explicitly ask to add a comment, leave the comment parameter empty.',
            },
            { role: 'user', content: message },
            choice.message,
            {
              role: 'function',
              name: functionName,
              content: formatted,
            },
          ],
        });

        const finalMessage = secondResponse.choices[0].message;
        return res.json({
          result: finalMessage.content,
          tool_used: functionName,
          raw_result: rawResult,
        });
      } else {
        // No function call, just respond with the message
        return res.json({
          result: choice.message.content,
          tool_used: null,
        });
      }
    } catch (error: any) {
      console.error('OpenAI error:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.listen(port, () => {
    console.log(`HTTP API server listening on port ${port}`);
  });
};

// Start servers
if (process.argv.includes('--stdio')) {
  // Run as MCP server over stdio
  const transport = new StdioServerTransport();
  server.connect(transport).then(() => {
    console.error('Azure DevOps MCP server running on stdio');
  });
} else {
  // Run as HTTP server (for development)
  startHttpServer();
  console.log('Running in HTTP mode (not MCP stdio). Use --stdio for MCP protocol.');
}