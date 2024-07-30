const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const context = github.context;
    const ref = context.ref; // This will be in the format "refs/heads/branch-name"
    const branchName = ref.replace('refs/heads/', '');
    const exampleInput = core.getInput('exampleInput')
    var newVersion = 'default'

    if (/^feature\/.+$/.test(branchName) || /^dev.+$/.test(branchName)) {
      newVersion = 'latest'
    } else {
      newVersion = 'from-tag'
    }

    core.setOutput('branch-name', branchName);
    core.setOutput('new-version', newVersion);
    core.setOutput('example-input', exampleInput);

    console.log(`Branch Name: ${branchName}`);
    console.log(`New Version: ${newVersion}`);
    console.log(`Example Input: ${exampleInput}`);

  } catch (error) {
    core.setFailed(error.message);
  }
}

run();
