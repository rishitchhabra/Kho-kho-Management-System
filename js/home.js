// Home page functionality
(async function() {
    const gridEl = document.getElementById("teamGrid");
    const emptyStateEl = document.getElementById("emptyState");
    const teamCountEl = document.getElementById("teamCount");
    const genderFilter = document.getElementById("genderFilter");
    const upcomingMatchesEl = document.getElementById("upcomingMatches");
    const noMatchesEl = document.getElementById("noMatches");
    const pastMatchesEl = document.getElementById("pastMatches");
    const noPastMatchesEl = document.getElementById("noPastMatches");

    let teams = [];
    let matches = [];
    let pastMatches = [];
    let pools = [];

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
        
        // Sort by match_order and take top 5
        const sortedMatches = [...matches]
            .sort((a, b) => (a.match_order || 0) - (b.match_order || 0))
            .slice(0, 5);

        upcomingMatchesEl.innerHTML = sortedMatches.map((match, index) => {
            const team1 = teams.find(t => String(t.id) === String(match.team1_id));
            const team2 = teams.find(t => String(t.id) === String(match.team2_id));
            const pool = pools.find(p => p.id === match.pool_id);
            
            return `
                <div class="match-card ${index === 0 ? 'featured' : ''}">
                    <div class="match-number">Match ${index + 1}</div>
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
        
        // Sort by most recent first (newest completed matches)
        const sortedPastMatches = [...pastMatches]
            .sort((a, b) => new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at))
            .slice(0, 10);

        pastMatchesEl.innerHTML = sortedPastMatches.map(match => {
            const team1 = teams.find(t => String(t.id) === String(match.team1_id));
            const team2 = teams.find(t => String(t.id) === String(match.team2_id));
            const winner = teams.find(t => String(t.id) === String(match.winner_id));
            const pool = pools.find(p => p.id === match.pool_id);
            const scores = match.score ? match.score.split(' - ') : ['0', '0'];
            
            const team1Won = String(match.winner_id) === String(match.team1_id);
            const team2Won = String(match.winner_id) === String(match.team2_id);
            
            return `
                <div class="past-match-card">
                    <div class="past-match-header">
                        <span class="pool-badge">${pool ? pool.name : ''}</span>
                        <span class="completed-badge">✅ Completed</span>
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

    // --- Render team cards to the grid ---
    function renderTeams(collection) {
        gridEl.innerHTML = "";

        if (!collection || !collection.length) {
            emptyStateEl.hidden = false;
            teamCountEl.textContent = 0;
            return;
        }

        emptyStateEl.hidden = true;
        collection.forEach((team) => {
            const card = document.createElement("article");
            card.className = "team-card";
            const pillClass = team.team_type === 'male' ? 'male' : 'female';
            const pillText = team.team_type === 'male' ? '👨 Male Team' : '👩 Female Team';
            
            card.innerHTML = `
                <div class="pill ${pillClass}">${pillText}</div>
                <h2>${team.school_name}</h2>
                <div class="team-meta">
                    <span>🎯 Coach: ${team.coach_name}</span>
                    <span>📞 ${team.coach_number}</span>
                    <span>👥 ${team.player_count} Players</span>
                </div>
            `;
            gridEl.appendChild(card);
        });

        teamCountEl.textContent = collection.length;
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
        const filteredTeams = teams.filter(t => t.team_type === value);
        renderTeams(filteredTeams);
        await renderMatches(value);
        await renderPastMatches(value);
    }

    // Initial render
    await applyFilter();

    // Gender filter event listener
    genderFilter.addEventListener("change", applyFilter);
})();
