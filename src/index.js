const core = require('@actions/core');
const github = require('@actions/github');

async function run() {
  try {
    const context = github.context;

    const ref = context.ref; // This will be in the format "refs/heads/branch-name"
    const branchName = ref.replace('refs/heads/', '');
    const commitSha = context.sha;
    const payload = context.payload;
    const workflow = context.workflow;
    const eventName= context.eventName;
    const job= context.job;
    const runId= context.runId;
    const runNumber= context.runNumber;

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
    console.log(`workflow: ${workflow}`);
    console.log(`eventName: ${eventName}`);
    console.log(`job: ${job}`);
    console.log(`runId: ${runId}`);
    console.log(`runNumber: ${runNumber}`);

  } catch (error) {
    core.setFailed(error);
  }
}

run();
