const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const context = github.context;
    const ref = context.ref; // This will be in the format "refs/heads/branch-name"
    const branchName = ref.replace('refs/heads/', '');

    console.log(`Branch Name: ${branchName}`);
    core.setOutput('branch-name', branchName);

    if (/^feature\/.+$/.test(branchName) || /^dev.+$/.test(branchName)) {
      core.setOutput('new-version', 'latest');
    } else {
      core.setOutput('new-version', '');
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
