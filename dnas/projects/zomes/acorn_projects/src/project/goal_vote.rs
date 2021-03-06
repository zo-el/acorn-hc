use dna_help::{WrappedAgentPubKey, WrappedHeaderHash, crud};
use hdk3::prelude::*;

#[hdk_entry(id = "goal_vote")]
#[derive(Debug, Clone, PartialEq)]
pub struct GoalVote {
    pub goal_address: WrappedHeaderHash,
    pub urgency: f64,
    pub importance: f64,
    pub impact: f64,
    pub effort: f64,
    pub agent_address: WrappedAgentPubKey,
    pub unix_timestamp: f64,
}

crud!(GoalVote, goal_vote, "goal_vote");
