// Home page functionality
(async function() {
    const gridEl = document.getElementById("teamGrid");
    const emptyStateEl = document.getElementById("emptyState");
    const teamCountEl = document.getElementById("teamCount");
    const genderFilter = document.getElementById("genderFilter");
    const poolFilter = document.getElementById("poolFilter");
    const upcomingMatchesEl = document.getElementById("upcomingMatches");
    const noMatchesEl = document.getElementById("noMatches");
    const pastMatchesEl = document.getElementById("pastMatches");
    const noPastMatchesEl = document.getElementById("noPastMatches");

    let teams = [];
    let matches = [];
    let pastMatches = [];
    let pools = [];

    // Get team's pool name
    function getTeamPool(teamId) {
        const pool = pools.find(p => {
            if (!p.team_ids || !Array.isArray(p.team_ids)) return false;
            // Check both string and number comparison
            return p.team_ids.some(id => String(id) === String(teamId));
        });
        return pool ? pool.name : null;
    }

    // --- Render upcoming matches ---
    async function renderMatches(teamType) {
        if (!upcomingMatchesEl) return;

        upcomingMatchesEl.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        
        matches = await getMatches(teamType, 'upcoming');
        pools = await getPools(teamType);
        
        if (!matches || !matches.length) {
            upcomingMatchesEl.innerHTML = '';
            noMatchesEl.hidden = false;
            return;
        }

        noMatchesEl.hidden = true;
        
        // Sort by match_order for display order (upcoming matches)
        const sortedMatches = [...matches]
            .sort((a, b) => (a.match_order || 0) - (b.match_order || 0))
            .slice(0, 5);

        upcomingMatchesEl.innerHTML = sortedMatches.map((match, index) => {
            const team1 = teams.find(t => String(t.id) === String(match.team1_id));
            const team2 = teams.find(t => String(t.id) === String(match.team2_id));
            const pool = pools.find(p => p.id === match.pool_id);
            // Use stored match_number (permanent)
            const matchNumber = match.match_number || match.match_order || '-';
            
            return `
                <div class="match-card ${index === 0 ? 'featured' : ''}">
                    <div class="match-number">Match ${matchNumber}</div>
                    <div class="match-content">
                        <div class="match-team">
                            <span class="team-emoji">🏫</span>
                            <span class="team-name">${team1 ? team1.school_name : 'TBD'}</span>
                        </div>
                        <div class="match-vs">VS</div>
                        <div class="match-team">
                            <span class="team-emoji">🏫</span>
                            <span class="team-name">${team2 ? team2.school_name : 'TBD'}</span>
                        </div>
                    </div>
                    <div class="match-pool">${pool ? pool.name : ''}</div>
                </div>
            `;
        }).join('');
    }

    // --- Render past matches ---
    async function renderPastMatches(teamType) {
        if (!pastMatchesEl) return;

        pastMatchesEl.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
        
        pastMatches = await getMatches(teamType, 'completed');
        
        if (!pastMatches || !pastMatches.length) {
            pastMatchesEl.innerHTML = '';
            if (noPastMatchesEl) noPastMatchesEl.hidden = false;
            return;
        }

        if (noPastMatchesEl) noPastMatchesEl.hidden = true;
        
        // Sort by match_number descending (most recent completed first)
        const sortedPastMatches = [...pastMatches]
            .sort((a, b) => (b.match_number || b.match_order || 0) - (a.match_number || a.match_order || 0))
            .slice(0, 10);

        pastMatchesEl.innerHTML = sortedPastMatches.map(match => {
            const team1 = teams.find(t => String(t.id) === String(match.team1_id));
            const team2 = teams.find(t => String(t.id) === String(match.team2_id));
            const winner = teams.find(t => String(t.id) === String(match.winner_id));
            const pool = pools.find(p => p.id === match.pool_id);
            const scores = match.score ? match.score.split(' - ') : ['0', '0'];
            // Use stored match_number (permanent)
            const matchNumber = match.match_number || match.match_order || '-';
            
            const team1Won = String(match.winner_id) === String(match.team1_id);
            const team2Won = String(match.winner_id) === String(match.team2_id);
            
            return `
                <div class="past-match-card">
                    <div class="past-match-number">Match ${matchNumber}</div>
                    <div class="past-match-header">
                        <span class="pool-badge">${pool ? pool.name : ''}</span>
                        <span class="completed-badge">✅</span>
                    </div>
                    <div class="past-match-teams">
                        <div class="past-match-team ${team1Won ? 'winner' : ''}">
                            <span class="team-name">${team1 ? team1.school_name : 'Unknown'}</span>
                            <span class="team-score">${scores[0] || '0'}</span>
                            ${team1Won ? '<span class="winner-badge">🏆</span>' : ''}
                        </div>
                        <div class="past-match-team ${team2Won ? 'winner' : ''}">
                            <span class="team-name">${team2 ? team2.school_name : 'Unknown'}</span>
                            <span class="team-score">${scores[1] || '0'}</span>
                            ${team2Won ? '<span class="winner-badge">🏆</span>' : ''}
                        </div>
                    </div>
                </div>
            `;
        }).join('');
    }

    // --- Team View Modal ---
    const teamViewModal = document.getElementById('teamViewModal');
    const modalClose = document.getElementById('closeTeamView');
    const modalContent = document.getElementById('teamViewContent');

    function openTeamViewModal(teamId) {
        const team = teams.find(t => String(t.id) === String(teamId));
        if (!team) return;

        const teamPool = getTeamPool(team.id);
        const pillClass = team.team_type === 'male' ? 'male' : 'female';
        const pillText = team.team_type === 'male' ? '👨 Male Team' : '👩 Female Team';

        // Get team's upcoming matches
        const teamUpcoming = matches.filter(m => 
            String(m.team1_id) === String(teamId) || String(m.team2_id) === String(teamId)
        ).slice(0, 3);

        // Get team's past matches
        const teamPast = pastMatches.filter(m => 
            String(m.team1_id) === String(teamId) || String(m.team2_id) === String(teamId)
        ).slice(0, 5);

        // Parse players
        let players = [];
        try {
            players = typeof team.players === 'string' ? JSON.parse(team.players) : (team.players || []);
        } catch (e) {
            players = [];
        }

        // Calculate stats
        const totalMatches = teamPast.length;
        const wins = teamPast.filter(m => String(m.winner_id) === String(teamId)).length;
        const losses = totalMatches - wins;

        modalContent.innerHTML = `
            <div class="modal-team-header">
                <h1>🏫 ${team.school_name}</h1>
                <div class="modal-badges">
                    <span class="pill ${pillClass}">${pillText}</span>
                    ${teamPool ? `<span class="pool-pill">${teamPool}</span>` : ''}
                </div>
            </div>

            <div class="modal-section">
                <h3>📊 Team Statistics</h3>
                <div class="stats-grid">
                    <div class="stat-item">
                        <span class="stat-value">${totalMatches}</span>
                        <span class="stat-label">Matches Played</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${wins}</span>
                        <span class="stat-label">Wins</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${losses}</span>
                        <span class="stat-label">Losses</span>
                    </div>
                    <div class="stat-item">
                        <span class="stat-value">${totalMatches > 0 ? Math.round((wins/totalMatches)*100) : 0}%</span>
                        <span class="stat-label">Win Rate</span>
                    </div>
                </div>
            </div>

            <div class="modal-section">
                <h3>🎯 Coach Details</h3>
                <div class="coach-info">
                    <p><strong>Name:</strong> ${team.coach_name}</p>
                    <p><strong>Phone:</strong> ${team.coach_number}</p>
                </div>
            </div>

            <div class="modal-section">
                <h3>👥 Players (${players.length})</h3>
                <div class="players-list">
                    ${players.length > 0 ? players.map((player, index) => `
                        <div class="player-item">
                            <span class="player-number">${index + 1}</span>
                            <span class="player-name">${player.name || player}</span>
                            ${player.class ? `<span class="player-class">Class ${player.class}</span>` : ''}
                        </div>
                    `).join('') : '<p class="no-data">No players registered</p>'}
                </div>
            </div>

            <div class="modal-section">
                <h3>📅 Upcoming Matches</h3>
                <div class="modal-matches">
                    ${teamUpcoming.length > 0 ? teamUpcoming.map(match => {
                        const opponent = teams.find(t => 
                            String(t.id) === (String(match.team1_id) === String(teamId) ? String(match.team2_id) : String(match.team1_id))
                        );
                        const pool = pools.find(p => p.id === match.pool_id);
                        return `
                            <div class="modal-match-card">
                                <span class="match-label">Match ${match.match_number || '-'}</span>
                                <span class="vs-text">vs ${opponent ? opponent.school_name : 'TBD'}</span>
                                ${pool ? `<span class="pool-tag">${pool.name}</span>` : ''}
                            </div>
                        `;
                    }).join('') : '<p class="no-data">No upcoming matches</p>'}
                </div>
            </div>

            <div class="modal-section">
                <h3>📜 Past Matches</h3>
                <div class="modal-matches">
                    ${teamPast.length > 0 ? teamPast.map(match => {
                        const opponent = teams.find(t => 
                            String(t.id) === (String(match.team1_id) === String(teamId) ? String(match.team2_id) : String(match.team1_id))
                        );
                        const won = String(match.winner_id) === String(teamId);
                        const scores = match.score ? match.score.split(' - ') : ['0', '0'];
                        return `
                            <div class="modal-match-card ${won ? 'won' : 'lost'}">
                                <span class="match-label">Match ${match.match_number || '-'}</span>
                                <span class="vs-text">vs ${opponent ? opponent.school_name : 'Unknown'}</span>
                                <span class="score-text">${match.score || '0 - 0'}</span>
                                <span class="result-badge">${won ? '🏆 Won' : '❌ Lost'}</span>
                            </div>
                        `;
                    }).join('') : '<p class="no-data">No past matches</p>'}
                </div>
            </div>
        `;

        teamViewModal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeTeamViewModal() {
        teamViewModal.classList.remove('active');
        document.body.style.overflow = '';
    }

    // Close modal events
    if (modalClose) {
        modalClose.addEventListener('click', closeTeamViewModal);
    }
    if (teamViewModal) {
        teamViewModal.addEventListener('click', (e) => {
            if (e.target === teamViewModal) {
                closeTeamViewModal();
            }
        });
    }
    // Close on Escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && teamViewModal && teamViewModal.classList.contains('active')) {
            closeTeamViewModal();
        }
    });

    // --- Render team cards to the grid ---
    function renderTeams(collection, poolFilterValue = 'all') {
        gridEl.innerHTML = "";

        // Filter by pool if needed
        let filteredCollection = collection;
        if (poolFilterValue && poolFilterValue !== 'all') {
            filteredCollection = collection.filter(team => {
                const teamPool = getTeamPool(team.id);
                // Case-insensitive comparison
                return teamPool && teamPool.toLowerCase() === poolFilterValue.toLowerCase();
            });
        }

        if (!filteredCollection || !filteredCollection.length) {
            emptyStateEl.hidden = false;
            teamCountEl.textContent = 0;
            return;
        }

        emptyStateEl.hidden = true;
        filteredCollection.forEach((team) => {
            const card = document.createElement("article");
            card.className = "team-card";
            const pillClass = team.team_type === 'male' ? 'male' : 'female';
            const pillText = team.team_type === 'male' ? '👨 Male Team' : '👩 Female Team';
            const teamPool = getTeamPool(team.id);
            
            card.innerHTML = `
                <div class="card-badges">
                    <div class="pill ${pillClass}">${pillText}</div>
                    ${teamPool ? `<div class="pool-pill">${teamPool}</div>` : ''}
                </div>
                <h2>${team.school_name}</h2>
                <div class="team-meta">
                    <span>🎯 Coach: ${team.coach_name}</span>
                    <span>📞 ${team.coach_number}</span>
                    <span>👥 ${team.player_count} Players</span>
                </div>
                <button class="view-team-btn" data-team-id="${team.id}">👁 View Team</button>
            `;
            
            // Add click event for view button
            const viewBtn = card.querySelector('.view-team-btn');
            viewBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                openTeamViewModal(team.id);
            });
            
            gridEl.appendChild(card);
        });

        teamCountEl.textContent = filteredCollection.length;
    }

    // Load teams from DB
    teams = await getTeams();

    // If no genderFilter element, just render all
    if (!genderFilter) {
        renderTeams(teams);
        return;
    }

    // Set initial filter value
    genderFilter.value = genderFilter.value || "male";

    // Apply initial filter and render
    async function applyFilter() {
        const value = genderFilter.value;
        const poolValue = poolFilter ? poolFilter.value : 'all';
        const filteredTeams = teams.filter(t => t.team_type === value);
        
        // Load pools for the selected gender
        pools = await getPools(value);
        
        await renderMatches(value);
        await renderPastMatches(value);
        renderTeams(filteredTeams, poolValue);
    }

    // Initial render
    await applyFilter();

    // Gender filter event listener
    genderFilter.addEventListener("change", applyFilter);

    // Pool filter event listener
    if (poolFilter) {
        poolFilter.addEventListener("change", async () => {
            const value = genderFilter.value;
            const poolValue = poolFilter.value;
            const filteredTeams = teams.filter(t => t.team_type === value);
            
            // Ensure pools are loaded
            if (!pools || pools.length === 0) {
                pools = await getPools(value);
            }
            
            renderTeams(filteredTeams, poolValue);
        });
    }
})();
