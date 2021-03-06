use dna_help::{WrappedAgentPubKey, WrappedHeaderHash, crud};
use hdk3::prelude::*;

// The "Entry" in EntryPoint is not a reference to Holochain "Entries"
// it is rather the concept of an Entrance, as in a doorway, to the tree
#[hdk_entry(id = "entry_point")]
#[derive(Debug, Clone, PartialEq)]
pub struct EntryPoint {
    pub color: String,
    pub creator_address: WrappedAgentPubKey,
    pub created_at: f64,
    pub goal_address: WrappedHeaderHash,
}

crud!(EntryPoint, entry_point, "entry_point");