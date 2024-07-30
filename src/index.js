const core = require('@actions/core');
const github = require('@actions/github');

async function get_tag(octokit, context, fetch_count) {
  const params = {
    owner: context.repo.owner,
    repo: context.repo.repo
  };

  if (fetch_count) {
    params.per_page = fetch_count;
  }


  return await octokit.repos.listTags(params);
}

function check_pre_release(pre_release_branches, current_branch) {
  if (!pre_release_branches) {
    return false;
  }

  const branchList = pre_release_branches.split(',').map(item => item.trim());

  return branchList.some(branch => {
    const pattern = branch.replace('*', '.*');
    const regex = new RegExp(`^${pattern}$`);
    const matched = regex.test(current_branch);

    console.log(`pre_release check - current : [${current_branch}], target : [${branch}], matched : [${matched}]`);

    return matched;
  })
}

function get_last_version(tags, is_pre_release, snapshot_tag) {
  const tagNames = tags.data.map(tag => tag.name);

  if (is_pre_release) {
    if (tagNames && tagNames.length > 0) {
      return tagNames[0];
    }
    else {
      return null;
    }
  }
  else {
    const snapshotTag = tagNames.filter(tagName => tagName.includes(snapshot_tag));

    if (snapshotTag && snapshotTag.length > 0) {
      return snapshotTag[0];
    }
    else {
      return null;
    }
  }
}

async function run() {
  try {
    const input_github_token = core.getInput('github-token');
    const input_major_prefix = core.getInput('major-prefix');
    const input_minor_prefix = core.getInput('minor-prefix');
    const input_hotfix_prefix = core.getInput('hotfix-prefix');
    const input_version_prefix = core.getInput('version-prefix');
    const input_version_postfix = core.getInput('version-postfix');
    const input_pre_release_branches = core.getInput('pre-release-branches');
    const input_pre_release_tag = core.getInput('pre-release-tag');
    const input_base_version = core.getInput('base-version');
    const input_fetch_tag_count = Number(core.getInput('fetch-tag-count'));
    const input_create_tag = core.getBooleanInput("create-tag")
    const input_dry_run = core.getBooleanInput('dry-run');

    const context = github.context;

    const ref = context.ref; // This will be in the format "refs/heads/branch-name"
    const branchName = ref.replace('refs/heads/', '');

    console.log(`branch : [${branchName}]`);
    console.log(`commit sha : [${context.sha}]`)

    const octokit = github.getOctokit(input_github_token);

    const tags = await get_tag(octokit, context, input_fetch_tag_count);
    const is_pre_release = check_pre_release(input_pre_release_branches, branchName);
    const last_version = get_last_version(tags, is_pre_release, input_pre_release_tag);

    console.log(`is pre-release : [${is_pre_release}]`);
    console.log(`last version : [${last_version}]`);

    const payload = context.payload;
    const message = payload.head_commit.message;

    let output_new_version
    let output_previous_version
    let output_release_type
    let output_commit_message
    let output_commit_sha = context.sha
    let output_branch_name = context.ref.replace('refs/heads/', '');

    const exampleInput = core.getInput('exampleInput');

    var newVersion = 'default';

    if (/^feature\/.+$/.test(branchName) || /^dev.+$/.test(branchName)) {
      newVersion = 'latest'
    } else {
      newVersion = 'from-tag'
    }

    core.setOutput('branch-name', branchName);
    core.setOutput('new-version', newVersion);
    core.setOutput('example-input', exampleInput);

    console.log(`New Version: ${newVersion}`);
    console.log(`Branch Name: ${branchName}`);
    console.log(`Example Input: ${exampleInput}`);

    console.log(`commitSha: ${commitSha}`);
    console.log(`payload: ${JSON.stringify(payload, null, 2)}`);
    console.log(`message: ${payload.head_commit.message}`)

  } catch (error) {
    core.setFailed(error);
  }
}

run();
