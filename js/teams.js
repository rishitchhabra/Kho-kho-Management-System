// Shared teams data module with Supabase integration

const DEFAULT_TEAMS = [
    {
        school_name: "Gyan International School",
        coach_name: "Ananya Bhosale",
        coach_number: "9876543210",
        player_count: 12,
        team_type: "male"
    },
    {
        school_name: "Delhi Public School",
        coach_name: "Shyam Narayanan",
        coach_number: "9876543211",
        player_count: 10,
        team_type: "female"
    }
];

/**
 * Get all teams from Supabase
 * @returns {Promise<Array>} Array of team objects
 */
async function getTeams() {
    try {
        const { data, error } = await supabase
            .from('teams')
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error("Error fetching teams:", error);
            return DEFAULT_TEAMS;
        }

        if (!data || data.length === 0) {
            return DEFAULT_TEAMS;
        }

        return data;
    } catch (error) {
        console.error("Unable to fetch teams from Supabase:", error);
        return DEFAULT_TEAMS;
    }
}

/**
 * Add a new team to Supabase
 * @param {Object} team - Team object to add with players array
 * @returns {Promise<Object>} Result object with success status
 */
async function addTeam(team) {
    try {
        const { data, error } = await supabase
            .from('teams')
            .insert([{
                school_name: team.school_name,
                coach_name: team.coach_name,
                coach_number: team.coach_number,
                player_count: team.player_count || 12,
                team_type: team.team_type,
                players: team.players || null
            }])
            .select();

        if (error) {
            console.error("Error adding team:", error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error("Unable to add team to Supabase:", error);
        return { success: false, error };
    }
}

// ==================== POOL FUNCTIONS ====================

/**
 * Get all pools from Supabase
 * @param {string} teamType - 'male' or 'female' filter (optional)
 * @returns {Promise<Array>} Array of pool objects
 */
async function getPools(teamType = null) {
    try {
        let query = supabase
            .from('pools')
            .select('*')
            .order('created_at', { ascending: true });

        if (teamType) {
            query = query.eq('team_type', teamType);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching pools:", error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error("Unable to fetch pools from Supabase:", error);
        return [];
    }
}

/**
 * Create a new pool
 * @param {Object} pool - Pool object with name, team_type, team_ids
 * @returns {Promise<Object>} Result object
 */
async function createPool(pool) {
    try {
        console.log("Creating pool with data:", pool);
        
        const { data, error } = await supabase
            .from('pools')
            .insert([{
                name: pool.name,
                team_type: pool.team_type,
                team_ids: pool.team_ids
            }])
            .select();

        if (error) {
            console.error("Error creating pool:", error);
            return { success: false, error: error };
        }

        console.log("Pool created successfully:", data);
        return { success: true, data };
    } catch (error) {
        console.error("Unable to create pool:", error);
        return { success: false, error: { message: error.message || "Unknown error" } };
    }
}

/**
 * Update a pool
 * @param {number} id - Pool ID
 * @param {Object} poolData - Updated pool data
 * @returns {Promise<Object>} Result object
 */
async function updatePool(id, poolData) {
    try {
        const { data, error } = await supabase
            .from('pools')
            .update(poolData)
            .eq('id', id)
            .select();

        if (error) {
            console.error("Error updating pool:", error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error("Unable to update pool:", error);
        return { success: false, error };
    }
}

/**
 * Delete a pool
 * @param {number} id - Pool ID
 * @returns {Promise<boolean>} Success status
 */
async function deletePool(id) {
    try {
        const { error } = await supabase
            .from('pools')
            .delete()
            .eq('id', id);

        if (error) {
            console.error("Error deleting pool:", error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Unable to delete pool:", error);
        return false;
    }
}

// ==================== MATCH FUNCTIONS ====================

/**
 * Get all matches from Supabase
 * @param {string} teamType - 'male' or 'female' filter (optional)
 * @param {string} status - 'upcoming', 'completed' filter (optional)
 * @returns {Promise<Array>} Array of match objects
 */
async function getMatches(teamType = null, status = null) {
    try {
        let query = supabase
            .from('matches')
            .select('*')
            .order('match_order', { ascending: true });

        if (teamType) {
            query = query.eq('team_type', teamType);
        }

        if (status) {
            query = query.eq('status', status);
        }

        const { data, error } = await query;

        if (error) {
            console.error("Error fetching matches:", error);
            return [];
        }

        return data || [];
    } catch (error) {
        console.error("Unable to fetch matches from Supabase:", error);
        return [];
    }
}

/**
 * Create a single match
 * @param {Object} matchData - Match data object
 * @returns {Promise<Object>} Result object
 */
async function createMatch(matchData) {
    try {
        // Get current max order
        const existingMatches = await getMatches(matchData.team_type);
        const maxOrder = existingMatches.length > 0 
            ? Math.max(...existingMatches.map(m => m.match_order || 0)) 
            : 0;

        const { data, error } = await supabase
            .from('matches')
            .insert([{
                pool_id: matchData.pool_id,
                team1_id: matchData.team1_id,
                team2_id: matchData.team2_id,
                team_type: matchData.team_type,
                status: matchData.status || 'upcoming',
                match_order: maxOrder + 1
            }])
            .select();

        if (error) {
            console.error("Error creating match:", error);
            return { success: false, error };
        }

        return { success: true, data };
    } catch (error) {
        console.error("Unable to create match:", error);
        return { success: false, error };
    }
}

/**
 * Create matches for a pool (round-robin style)
 * @param {number} poolId - Pool ID
 * @param {Array} teamIds - Array of team IDs in the pool
 * @param {string} teamType - 'male' or 'female'
 * @returns {Promise<Object>} Result object
 */
async function createMatchesForPool(poolId, teamIds, teamType) {
    try {
        // Generate round-robin matches
        const matches = [];
        const existingMatches = await getMatches(teamType);
        let maxOrder = existingMatches.length > 0 
            ? Math.max(...existingMatches.map(m => m.match_order || 0)) 
            : 0;

        for (let i = 0; i < teamIds.length; i++) {
            for (let j = i + 1; j < teamIds.length; j++) {
                maxOrder++;
                matches.push({
                    pool_id: poolId,
                    team1_id: teamIds[i],
                    team2_id: teamIds[j],
                    team_type: teamType,
                    status: 'upcoming',
                    match_order: maxOrder
                });
            }
        }

        if (matches.length === 0) {
            return { success: false, error: "No matches to create" };
        }

        const { data, error } = await supabase
            .from('matches')
            .insert(matches)
            .select();

        if (error) {
            console.error("Error creating matches:", error);
            return { success: false, error };
        }

        return { success: true, data, count: matches.length };
    } catch (error) {
        console.error("Unable to create matches:", error);
        return { success: false, error };
    }
}

/**
 * Update match order
 * @param {number} matchId - Match ID
 * @param {number} newOrder - New order number
 * @returns {Promise<boolean>} Success status
 */
async function updateMatchOrder(matchId, newOrder) {
    try {
        const { error } = await supabase
            .from('matches')
            .update({ match_order: newOrder })
            .eq('id', matchId);

        if (error) {
            console.error("Error updating match order:", error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Unable to update match order:", error);
        return false;
    }
}

/**
 * Update match status
 * @param {number} matchId - Match ID
 * @param {string} status - 'upcoming', 'ongoing', 'completed'
 * @param {Object} result - Optional result object with winner_id, score
 * @returns {Promise<boolean>} Success status
 */
async function updateMatchStatus(matchId, status, result = null) {
    try {
        const updateData = { status };
        if (result) {
            updateData.winner_id = result.winner_id;
            updateData.score = result.score;
        }

        const { error } = await supabase
            .from('matches')
            .update(updateData)
            .eq('id', matchId);

        if (error) {
            console.error("Error updating match status:", error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Unable to update match status:", error);
        return false;
    }
}

/**
 * Mark a match as completed with winner and score
 * @param {number} matchId - Match ID
 * @param {string} winnerId - Winner team ID
 * @param {string} score - Match score (e.g., "45 - 32")
 * @returns {Promise<Object>} Result object
 */
async function completeMatch(matchId, winnerId, score) {
    try {
        const { error } = await supabase
            .from('matches')
            .update({
                status: 'completed',
                winner_id: winnerId,
                score: score
            })
            .eq('id', matchId);

        if (error) {
            console.error("Error completing match:", error);
            return { success: false, error };
        }

        return { success: true };
    } catch (error) {
        console.error("Unable to complete match:", error);
        return { success: false, error };
    }
}

/**
 * Update a past match (edit result, winner, score, match number)
 * @param {number} matchId - Match ID
 * @param {Object} updateData - Data to update { match_number, winner_id, score }
 * @returns {Promise<Object>} Result object
 */
async function updatePastMatch(matchId, updateData) {
    try {
        const { error } = await supabase
            .from('matches')
            .update({
                match_number: updateData.match_number,
                winner_id: updateData.winner_id,
                score: updateData.score
            })
            .eq('id', matchId);

        if (error) {
            console.error("Error updating past match:", error);
            return { success: false, error };
        }

        return { success: true };
    } catch (error) {
        console.error("Unable to update past match:", error);
        return { success: false, error };
    }
}

/**
 * Delete a match
 * @param {number} matchId - Match ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteMatch(matchId) {
    try {
        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('id', matchId);

        if (error) {
            console.error("Error deleting match:", error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Unable to delete match:", error);
        return false;
    }
}

/**
 * Delete all matches for a pool
 * @param {number} poolId - Pool ID
 * @returns {Promise<boolean>} Success status
 */
async function deleteMatchesByPool(poolId) {
    try {
        const { error } = await supabase
            .from('matches')
            .delete()
            .eq('pool_id', poolId);

        if (error) {
            console.error("Error deleting pool matches:", error);
            return false;
        }

        return true;
    } catch (error) {
        console.error("Unable to delete pool matches:", error);
        return false;
    }
}

/**
 * Swap match orders between two matches
 * @param {number} matchId1 - First match ID
 * @param {number} order1 - First match current order
 * @param {number} matchId2 - Second match ID  
 * @param {number} order2 - Second match current order
 * @returns {Promise<boolean>} Success status
 */
async function swapMatchOrders(matchId1, order1, matchId2, order2) {
    try {
        // Update first match to second's order
        await supabase
            .from('matches')
            .update({ match_order: order2 })
            .eq('id', matchId1);

        // Update second match to first's order
        await supabase
            .from('matches')
            .update({ match_order: order1 })
            .eq('id', matchId2);

        return true;
    } catch (error) {
        console.error("Unable to swap match orders:", error);
        return false;
    }
}

/**
 * Seed default teams to Supabase (run once if database is empty)
 * @returns {Promise<void>}
 */
async function seedDefaultTeams() {
    try {
        const { data: existingTeams } = await supabase
            .from('teams')
            .select('id')
            .limit(1);

        if (!existingTeams || existingTeams.length === 0) {
            const { error } = await supabase
                .from('teams')
                .insert(DEFAULT_TEAMS);

            if (error) {
                console.error("Error seeding teams:", error);
            } else {
                console.log("Default teams seeded successfully!");
            }
        }
    } catch (error) {
        console.error("Unable to seed teams:", error);
    }
}
