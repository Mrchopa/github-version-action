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

function get_last_version(tags, release_type, is_pre_release, snapshot_tag) {
  const tagNames = tags.data.map(tag => tag.name);

  if (!tagNames || tagNames.length === 0) return null

  return tagNames[0];
}

function get_release_type(context, is_pre_release) {
  if (!is_pre_release) {
    return 'pass';
  }

  const input_default_bump = core.getInput('default-bump');
  const input_major_prefix = core.getInput('major-prefix');
  const input_minor_prefix = core.getInput('minor-prefix');
  const input_hotfix_prefix = core.getInput('hotfix-prefix');

  const message = context.payload.head_commit.message;

  console.log(`commit message : [${message}]`);

  const lines = message.split('\n');

  const isMajor = lines.some(line => line.startsWith(input_major_prefix));
  const isMinor = lines.some(line => line.startsWith(input_minor_prefix));
  const isHotfix = lines.some(line => line.startsWith(input_hotfix_prefix));

  console.log(`is Major : [${isMajor}]`);
  console.log(`is Minor : [${isMinor}]`);
  console.log(`is Hotfix : [${isHotfix}]`);

  if (isMajor) return 'major';
  if (isMinor) return 'minor';
  if (isHotfix) return 'hotfix';

  console.log(`Unable to determine release type, using default bump - [${input_default_bump}]`)

  return input_default_bump;
}

function update_version(previous_version, release_type, is_pre_release) {
  if (!previous_version) previous_version = "0.0.0";

  const input_version_prefix = core.getInput('version-prefix');
  const input_pre_release_tag = core.getInput('pre-release-tag');

  const version = previous_version.replace('-'+input_pre_release_tag, '').replace(input_version_prefix, '').split('.');

  console.log(`previous version text - [${previous_version}]`);
  console.log(`plain previous version text - [${version}]`);

  let updated_version = null;

  // pre-release 이고 이전 tag도 pre-release 인 경우
  if (is_pre_release && previous_version.includes(input_pre_release_tag)) {
    // 현재와 이전 버전이 동일한 경우 (revision만 업데이트)
    if (
        (release_type === 'major' && version[1] === "0" && version[2] === "0")
        || (release_type === 'minor' && version[2] === "0")
        || (release_type === 'hotfix' && version[2] !== "0")
    ) {
      updated_version = input_version_prefix + version[0] + '.' + version[1] + '.' + version[2] + '-'+input_pre_release_tag;

      if (version.length === 3) {
        updated_version += '.0';
      }
      else if (version.length === 4) {
        updated_version += '.' + (Number(version[3]) + 1);
      }
      else {
        throw Error(`Invalid revision type version - [${previous_version}]`);
      }

      return updated_version;
    }
  }

  if (release_type === 'major') {
    updated_version = input_version_prefix + (Number(version[0]) + 1) + '.0.0';
  } else if (release_type === 'minor') {
    updated_version = input_version_prefix + version[0] + '.' + (Number(version[1]) + 1) + '.0';
  } else if (release_type === 'hotfix') {
    updated_version = input_version_prefix + version[0] + '.' + version[1] + '.' + (Number(version[2]) + 1);
  } else if (release_type === 'pass') {
    updated_version = input_version_prefix + version[0] + '.' + version[1] + '.' + version[2];
  } else {
    throw Error(`Invalid release type - [${release_type}]`);
  }

  if (is_pre_release) {
    updated_version += '-' + input_pre_release_tag + '.0';
  }

  return updated_version;
}

function update_base_version(base_version, release_type, is_pre_release) {
  const input_version_prefix = core.getInput('version-prefix');
  const input_pre_release_tag = core.getInput('pre-release-tag');

  const version = base_version.replace('-'+input_pre_release_tag, '').replace(input_version_prefix, '').split('.');

  console.log(`base version text - [${base_version}]`);
  console.log(`plain base version text - [${version}]`);

  let updated_version = null;

  updated_version = input_version_prefix + version[0] + '.' + version[1] + '.' + version[2];

  if (is_pre_release) {
    updated_version += '-' + input_pre_release_tag + '.0';
  }

  return updated_version;
}

async function create_tag(octokit, context, version, dry_run) {
  if (dry_run) {
    return null;
  }

  const response = await octokit.git.createTag({
    owner: context.repo.owner,
    repo: context.repo.repo,
    tag: version,
    message: '',
    object: context.sha,
    type: 'commit'
  });

  const tag_sha = response.data.sha;

  await octokit.git.createRef({
    owner: context.repo.owner,
    repo: context.repo.repo,
    ref: `refs/tags/${version}`,
    sha: tag_sha
  });

  return tag_sha;
}

function get_base_version(context, release_type) {
  const regex = new RegExp(`${release_type}:\\s*\\[([^\\]]+)\\]`);

  const match = context.payload.head_commit.message.match(regex);

  if (match && match[1]) {
    console.log(`input hard fix version : [${match[1]}]`);
    return match[1];
  }

  return null;
}

async function run() {
  try {
    const input_github_token = core.getInput('github-token');
    const input_version_prefix = core.getInput('version-prefix');
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

    const is_pre_release = check_pre_release(input_pre_release_branches, branchName);
    const release_type = get_release_type(context, is_pre_release);
    const base_version = get_base_version(context, release_type);

    console.log(`base version : [${base_version}]`);
    console.log(`is pre-release : [${is_pre_release}]`);
    console.log(`release type : [${release_type}]`);

    let new_version = null;

    const octokit = github.getOctokit(input_github_token);

    const tags = await get_tag(octokit, context, input_fetch_tag_count);
    const last_version = get_last_version(tags, release_type, is_pre_release, input_pre_release_tag);

    console.log(`last version : [${last_version}]`);

    if (base_version) {
      new_version = update_base_version(base_version, release_type, is_pre_release);
    }
    else {
      new_version = update_version(last_version, release_type, is_pre_release);
    }

    const tag_sha = await create_tag(octokit, context, new_version, input_dry_run);

    let output_new_version = new_version
    let output_previous_version = last_version;
    let output_release_type = release_type;
    let output_commit_message = context.payload.head_commit.message;
    let output_commit_sha = context.sha
    let output_branch_name = branchName;
    let output_tag_sha = tag_sha;

    core.setOutput('new-version', output_new_version);
    core.setOutput('previous-version', output_previous_version);
    core.setOutput('release-type', output_release_type);
    core.setOutput('commit-message', output_commit_message);
    core.setOutput('commit-sha', output_commit_sha);
    core.setOutput('branch-name', output_branch_name);
    core.setOutput('tag-sha', output_tag_sha);

  } catch (error) {
    core.setFailed(error);
  }
}

run();
