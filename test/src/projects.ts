import { Config, Orchestrator } from '@holochain/tryorama'
import * as _ from 'lodash'
import { delay } from './timer'

const ZOME = 'acorn_projects'
const ALICE_USER_NICK = 'alice'
const BOBBO_USER_NICK = 'bobbo'

// Configure a conductor with two identical DNAs,
// differentiated by UUID, nicknamed "alice" and "bobbo"
const config = Config.gen(
  {
    [ALICE_USER_NICK]: Config.dna('../dnas/projects/projects.dna.gz', null),
    [BOBBO_USER_NICK]: Config.dna('../dnas/projects/projects.dna.gz', null),
  }
  // { logger: Config.logger(true) }
)

interface Hash {
  hash: Buffer
  hash_type: Buffer
}

function newGoal(agentAddress: Hash, content: string) {
  return {
    content,
    description: 'Test Goal Description',
    user_hash: agentAddress,
    user_edit_hash: null,
    timestamp_created: Date.now(),
    timestamp_updated: null,
    hierarchy: { Root: null },
    status: { Uncertain: null },
    tags: null,
    time_frame: null,
  }
}

async function setup(scenario) {
  // spawn the conductor process
  const { cndtr } = await scenario.players({ cndtr: config })
  await cndtr.spawn()

  const [_dnaHash, agentAddress] = cndtr.cellId(ALICE_USER_NICK)

  function callAlice(fn: string, payload: any) {
    return cndtr.call(ALICE_USER_NICK, ZOME, fn, payload)
  }

  return { callAlice, agentAddress }
}

async function runPlainCrudTest({
  entryType,
  createEntry,
  updateEntry,
  baseEntry,
  callAlice,
  tape,
}) {
  // CREATE
  const entry = {
    ...baseEntry,
    ...createEntry,
  }
  const createResult = await callAlice(`create_${entryType}`, entry)
  tape.deepEqual(createResult.entry, entry)

  // READ
  const fetchResult = await callAlice(`fetch_${entryType}s`, null)
  tape.equal(fetchResult.length, 1)
  tape.deepEqual(fetchResult[0], createResult)

  // UDPATE
  const entryUpdate = {
    ...baseEntry,
    ...updateEntry,
  }
  const updateResult = await callAlice(`update_${entryType}`, {
    entry: entryUpdate,
    address: createResult.address,
  })
  // the address should stay continuous from the original creation
  // of the entry
  tape.deepEqual(updateResult.address, createResult.address)
  tape.deepEqual(updateResult.entry, entryUpdate)

  // ARCHIVE / DELETE
  const archiveResult = await callAlice(
    `archive_${entryType}`,
    createResult.address
  )
  tape.deepEqual(archiveResult, createResult.address)
}

module.exports = (orchestrator: Orchestrator<null>) => {
  orchestrator.registerScenario('member api', async (scenario, tape) => {
    const { callAlice, agentAddress } = await setup(scenario)

    const result = await callAlice('fetch_members', null)
    tape.equal(1, result.length)
    tape.deepEqual({
      address: agentAddress
    }, result[0])
  })

  orchestrator.registerScenario('goal api', async (scenario, tape) => {
    const { callAlice, agentAddress } = await setup(scenario)

    // CREATE
    const goal = newGoal(agentAddress, 'Test Goal Content')
    const createGoalResult = await callAlice('create_goal', goal)
    tape.deepEqual(createGoalResult.entry, goal)

    // READ
    const fetchGoalsResult = await callAlice('fetch_goals', null)
    tape.equal(fetchGoalsResult.length, 1)
    tape.deepEqual(fetchGoalsResult[0], createGoalResult)

    // UDPATE
    const updatedGoal = newGoal(agentAddress, 'Updated Goal Content')
    const updateGoalResult = await callAlice('update_goal', {
      entry: updatedGoal,
      address: createGoalResult.address,
    })
    // the address should stay continuous from the original creation
    // of the goal
    tape.deepEqual(updateGoalResult.address, createGoalResult.address)
    tape.deepEqual(updateGoalResult.entry, updatedGoal)

    const fetchGoals2Result = await callAlice('fetch_goals', null)
    tape.equal(fetchGoals2Result.length, 1)
    // the address should stay continuous from the original creation
    // of the goal, but the entry/goal itself should contain the updated
    // values
    tape.deepEqual(fetchGoals2Result[0], updateGoalResult)

    // ARCHIVE / DELETE
    const archiveGoalResult = await callAlice(
      'archive_goal',
      createGoalResult.address
    )
    tape.deepEqual(archiveGoalResult, createGoalResult.address)

    const fetchGoals3Result = await callAlice('fetch_goals', null)
    tape.equal(fetchGoals3Result.length, 0)
  })

  orchestrator.registerScenario('edge api', async (scenario, tape) => {
    const { callAlice, agentAddress } = await setup(scenario)

    const goal1 = newGoal(agentAddress, 'Test Goal 1')
    const goal2 = newGoal(agentAddress, 'Test Goal 2')
    const createGoal1Result = await callAlice('create_goal', goal1)
    const createGoal2Result = await callAlice('create_goal', goal2)

    await runPlainCrudTest({
      entryType: 'edge',
      createEntry: {
        parent_address: createGoal1Result.address,
        child_address: createGoal2Result.address,
      },
      updateEntry: {
        // switch the parent and child
        parent_address: createGoal2Result.address,
        child_address: createGoal1Result.address,
      },
      baseEntry: {
        randomizer: 321, // anything here
      },
      callAlice,
      tape,
    })
  })

  orchestrator.registerScenario('entry_point api', async (scenario, tape) => {
    const { callAlice, agentAddress } = await setup(scenario)

    const goal1 = newGoal(agentAddress, 'Test Goal 1')
    const createGoal1Result = await callAlice('create_goal', goal1)

    await runPlainCrudTest({
      entryType: 'entry_point',
      createEntry: {
        color: '#BBB222',
      },
      updateEntry: {
        color: '#AAA111',
      },
      baseEntry: {
        goal_address: createGoal1Result.entry_address,
        created_at: Date.now(),
        creator_address: agentAddress,
      },
      callAlice,
      tape,
    })
  })

  orchestrator.registerScenario('goal_comment api', async (scenario, tape) => {
    const { callAlice, agentAddress } = await setup(scenario)

    const goal1 = newGoal(agentAddress, 'Test Goal 1')
    const createGoal1Result = await callAlice('create_goal', goal1)

    await runPlainCrudTest({
      entryType: 'goal_comment',
      createEntry: {
        content: 'Comment Create',
      },
      updateEntry: {
        content: 'Comment Update',
      },
      baseEntry: {
        goal_address: createGoal1Result.address,
        unix_timestamp: Date.now(),
        agent_address: agentAddress,
      },
      callAlice,
      tape,
    })
  })

  orchestrator.registerScenario('goal_member api', async (scenario, tape) => {
    const { callAlice, agentAddress } = await setup(scenario)

    const goal1 = newGoal(agentAddress, 'Test Goal 1')
    const createGoal1Result = await callAlice('create_goal', goal1)

    await runPlainCrudTest({
      entryType: 'goal_member',
      createEntry: {
        unix_timestamp: 4321,
      },
      updateEntry: {
        unix_timestamp: 1234,
      },
      baseEntry: {
        goal_address: createGoal1Result.address,
        user_edit_hash: agentAddress,
        agent_address: agentAddress,
      },
      callAlice,
      tape,
    })
  })

  orchestrator.registerScenario('goal_vote api', async (scenario, tape) => {
    const { callAlice, agentAddress } = await setup(scenario)

    const goal1 = newGoal(agentAddress, 'Test Goal 1')
    const createGoal1Result = await callAlice('create_goal', goal1)

    await runPlainCrudTest({
      entryType: 'goal_vote',
      createEntry: {
        urgency: 0.5,
      },
      updateEntry: {
        urgency: 0.8,
      },
      baseEntry: {
        goal_address: createGoal1Result.address,
        importance: 1,
        impact: 1,
        effort: 1,
        unix_timestamp: Date.now(),
        agent_address: agentAddress,
      },
      callAlice,
      tape,
    })
  })

  orchestrator.registerScenario('project_meta api', async (scenario, tape) => {
    const { callAlice, agentAddress } = await setup(scenario)

    await runPlainCrudTest({
      entryType: 'project_meta',
      createEntry: {
        name: 'Initial Name',
      },
      updateEntry: {
        name: 'Rename',
      },
      baseEntry: {
        creator_address: agentAddress,
        created_at: Date.now(),
        image: '',
        passphrase: 'pinky-stomp-tuffle-waffle',
      },
      callAlice,
      tape,
    })

    // at this point, the initial one should have been archived
    try {
      await callAlice('fetch_project_meta', null)
    } catch (e) {
      tape.equal(true, e.data.data.includes('no project meta exists'))
    }
  })
}
