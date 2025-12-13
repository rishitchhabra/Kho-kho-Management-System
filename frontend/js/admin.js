// Admin page functionality with CRUD operations for Teams, Pools, Matches, and Users
(async function() {
    // DOM Elements - Teams
    const gridEl = document.getElementById("teamGrid");
    const emptyStateEl = document.getElementById("emptyState");
    const filterEl = document.getElementById("filter");
    const modal = document.getElementById("editModal");
    const deleteModal = document.getElementById("deleteModal");

    // DOM Elements - Pools
    const poolGrid = document.getElementById("poolGrid");
    const poolEmptyState = document.getElementById("poolEmptyState");
    const poolModal = document.getElementById("poolModal");
    const editPoolModal = document.getElementById("editPoolModal");
    const deletePoolModal = document.getElementById("deletePoolModal");
    const fixMatchModal = document.getElementById("fixMatchModal");

    // DOM Elements - Matches
    const matchList = document.getElementById("matchList");
    const matchEmptyState = document.getElementById("matchEmptyState");

    // DOM Elements - Users
    const userGrid = document.getElementById("userGrid");
    const userEmptyState = document.getElementById("userEmptyState");
    const userModal = document.getElementById("userModal");
    const editUserModal = document.getElementById("editUserModal");
    const deleteUserModal = document.getElementById("deleteUserModal");

    // DOM Elements - Tabs
    const tabBtns = document.querySelectorAll(".tab-btn");
    const tabContents = document.querySelectorAll(".tab-content");

    // State
    let teams = [];
    let pools = [];
    let matches = [];
    let users = [];
    let currentEditId = null;
    let currentDeleteId = null;
    let currentPoolId = null;
    let currentDeletePoolId = null;
    let currentFixMatchPoolId = null;
    let currentEditUserId = null;
    let currentDeleteUserId = null;
    let draggedMatch = null;

    // DOM Elements - Search
    const searchInput = document.getElementById("teamSearchInput");
    const clearSearchBtn = document.getElementById("clearSearchBtn");
    const searchResults = document.getElementById("searchResults");
    const searchResultsContent = document.getElementById("searchResultsContent");
    const closeSearchResults = document.getElementById("closeSearchResults");

    // ==================== HELPER FUNCTIONS ====================
    function getTeamPool(teamId) {
        const pool = pools.find(p => p.team_ids && p.team_ids.includes(teamId));
        return pool ? pool.name : null;
    }

    // ==================== PERSISTENCE HELPERS ====================
    function saveToStorage(key, value) {
        localStorage.setItem(`khoKhoAdmin_${key}`, value);
    }

    function getFromStorage(key, defaultValue) {
        return localStorage.getItem(`khoKhoAdmin_${key}`) || defaultValue;
    }

    // ==================== TAB NAVIGATION ====================
    function switchToTab(tabName) {
        // Update active button
        tabBtns.forEach(b => b.classList.remove("active"));
        const activeBtn = document.querySelector(`[data-tab="${tabName}"]`);
        if (activeBtn) activeBtn.classList.add("active");
        
        // Update active content
        tabContents.forEach(content => {
            content.classList.remove("active");
            if (content.id === `${tabName}Tab`) {
                content.classList.add("active");
            }
        });
        // Tab persistence removed - always start on teams tab

        // Refresh data based on tab
        if (tabName === "pools") {
            loadPools();
        } else if (tabName === "matches") {
            loadMatches();
        } else if (tabName === "users") {
            loadUsers();
        }
    }

    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const tabName = btn.dataset.tab;
            switchToTab(tabName);
        });
    });

    // ==================== TEAM FUNCTIONS ====================

    async function deleteTeam(id) {
        try {
            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', id);

            if (error) {
                console.error("Error deleting team:", error);
                showNotification("Failed to delete team", "error");
                return false;
            }
            showNotification("Team deleted successfully!", "success");
            logActivity('teams', 'delete', id, `Deleted team`);
            return true;
        } catch (error) {
            console.error("Unable to delete team:", error);
            showNotification("Failed to delete team", "error");
            return false;
        }
    }

    async function updateTeam(id, teamData) {
        try {
            const { data, error } = await supabase
                .from('teams')
                .update(teamData)
                .eq('id', id)
                .select();

            if (error) {
                console.error("Error updating team:", error);
                showNotification("Failed to update team", "error");
                return false;
            }
            showNotification("Team updated successfully!", "success");
            logActivity('teams', 'update', id, `Updated team: ${teamData.school_name || 'Unknown'}`);
            return true;
        } catch (error) {
            console.error("Unable to update team:", error);
            showNotification("Failed to update team", "error");
            return false;
        }
    }

    function showNotification(message, type = "success") {
        const notification = document.createElement("div");
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <span>${type === "success" ? "✅" : "❌"}</span>
            <span>${message}</span>
        `;
        document.body.appendChild(notification);

        setTimeout(() => {
            notification.classList.add("fade-out");
            setTimeout(() => notification.remove(), 300);
        }, 3000);
    }

    function renderTeams(collection) {
        gridEl.innerHTML = "";

        if (!collection || !collection.length) {
            emptyStateEl.hidden = false;
            return;
        }

        emptyStateEl.hidden = true;
        
        const canEdit = hasPermission('teams', 'edit');
        const canDelete = hasPermission('teams', 'delete');
        
        collection.forEach((team) => {
            const card = document.createElement("article");
            card.className = "team-card";
            const pillClass = team.team_type === 'male' ? 'male' : 'female';
            const pillText = team.team_type === 'male' ? '👨 Male' : '👩 Female';
            const teamPool = getTeamPool(team.id);
            
            // Calculate UDISE verification status
            let players = [];
            try {
                players = typeof team.players === 'string' ? JSON.parse(team.players) : (team.players || []);
            } catch (e) {
                players = [];
            }
            const verifiedCount = players.filter(p => p.udise_status === 'verified').length;
            const allUdiseVerified = players.length === 12 && verifiedCount === 12;
            const udiseStatusClass = allUdiseVerified ? 'udise-verified' : 'udise-pending';
            const udiseStatusIcon = allUdiseVerified ? '✓' : '✗';
            const udiseStatusTitle = allUdiseVerified ? 'All UDISE Verified' : 'UDISE Pending/Incomplete';
            
            card.innerHTML = `
                <div class="card-header">
                    <div class="card-badges">
                        <span class="pill ${pillClass}">${pillText}</span>
                        ${teamPool ? `<span class="pool-badge">${teamPool}</span>` : ''}
                    </div>
                    <div class="card-actions">
                        <button class="btn-icon view-btn" data-id="${team.id}" title="View Team">👁</button>
                        ${canEdit ? `<button class="btn-icon edit-btn" data-id="${team.id}" title="Edit">✏️</button>` : ''}
                        ${canDelete ? `<button class="btn-icon delete-btn" data-id="${team.id}" title="Delete">🗑️</button>` : ''}
                    </div>
                </div>
                <h2>${team.school_name}</h2>
                <div class="team-meta">
                    <span>🎯 Coach: ${team.coach_name}</span>
                    <span>📞 ${team.coach_number}</span>
                    <span>👥 ${team.player_count} Players</span>
                </div>
                <div class="card-footer">
                    <span class="udise-status-badge ${udiseStatusClass}" title="${udiseStatusTitle}">UDISE: ${udiseStatusIcon}</span>
                </div>
            `;
            gridEl.appendChild(card);
        });

        // View team button handler
        gridEl.querySelectorAll(".view-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                const id = e.currentTarget.dataset.id;
                openViewTeamModal(id);
            });
        });

        // Use specific selectors within teamGrid for team buttons
        gridEl.querySelectorAll(".edit-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!hasPermission('teams', 'edit')) {
                    showNotification("You don't have permission to edit teams", "error");
                    return;
                }
                const id = e.currentTarget.dataset.id;
                openEditModal(id);
            });
        });

        gridEl.querySelectorAll(".delete-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!hasPermission('teams', 'delete')) {
                    showNotification("You don't have permission to delete teams", "error");
                    return;
                }
                const id = e.currentTarget.dataset.id;
                openDeleteModal(id);
            });
        });
    }

    // ==================== VIEW TEAM MODAL ====================
    const viewTeamModal = document.getElementById("viewTeamModal");
    const viewTeamContent = document.getElementById("viewTeamContent");
    const closeViewTeamModalBtn = document.getElementById("closeViewTeamModal");

    function openViewTeamModal(teamId) {
        const team = teams.find(t => String(t.id) === String(teamId));
        if (!team) return;

        const teamPool = getTeamPool(team.id);
        const pillClass = team.team_type === 'male' ? 'male' : 'female';
        const pillText = team.team_type === 'male' ? '👨 Male Team' : '👩 Female Team';

        // Get team's matches
        const teamMatches = matches.filter(m => 
            String(m.team1_id) === String(teamId) || String(m.team2_id) === String(teamId)
        );
        const upcomingMatches = teamMatches.filter(m => m.status === 'upcoming');
        const pastMatches = teamMatches.filter(m => m.status === 'completed');

        // Parse players
        let players = [];
        try {
            players = typeof team.players === 'string' ? JSON.parse(team.players) : (team.players || []);
        } catch (e) {
            players = [];
        }

        // Calculate UDISE verification status
        const verifiedCount = players.filter(p => p.udise_status === 'verified').length;
        const allUdiseVerified = players.length === 12 && verifiedCount === 12;
        const udiseStatusClass = allUdiseVerified ? 'udise-verified' : 'udise-pending';
        const udiseStatusText = allUdiseVerified ? '✓ All Verified' : `✗ ${verifiedCount}/12 Verified`;

        // Calculate stats
        const totalMatches = pastMatches.length;
        const wins = pastMatches.filter(m => String(m.winner_id) === String(teamId)).length;
        const losses = totalMatches - wins;

        viewTeamContent.innerHTML = `
            <div class="view-team-header">
                <h1>🏫 ${team.school_name}</h1>
                <div class="view-team-badges">
                    <span class="pill ${pillClass}">${pillText}</span>
                    ${teamPool ? `<span class="pool-badge">${teamPool}</span>` : '<span class="pool-badge-empty">No Pool</span>'}
                    <span class="udise-badge ${udiseStatusClass}">${udiseStatusText}</span>
                </div>
            </div>

            <div class="view-team-stats">
                <div class="stat-box">
                    <span class="stat-number">${totalMatches}</span>
                    <span class="stat-text">Matches</span>
                </div>
                <div class="stat-box wins">
                    <span class="stat-number">${wins}</span>
                    <span class="stat-text">Wins</span>
                </div>
                <div class="stat-box losses">
                    <span class="stat-number">${losses}</span>
                    <span class="stat-text">Losses</span>
                </div>
                <div class="stat-box">
                    <span class="stat-number">${totalMatches > 0 ? Math.round((wins/totalMatches)*100) : 0}%</span>
                    <span class="stat-text">Win Rate</span>
                </div>
            </div>

            <div class="view-team-section">
                <h3>🎯 Coach Details</h3>
                <div class="info-grid">
                    <div class="info-item">
                        <label>Name</label>
                        <span>${team.coach_name}</span>
                    </div>
                    <div class="info-item">
                        <label>Phone</label>
                        <span>${team.coach_number}</span>
                    </div>
                </div>
            </div>

            <div class="view-team-section">
                <h3>👥 Players (${players.length})</h3>
                <div class="players-grid">
                    ${players.length > 0 ? players.map((player, index) => {
                        const isVerified = player.udise_status === 'verified';
                        const udiseIcon = isVerified ? '<span class="player-udise verified" title="UDISE Verified">✓</span>' : '<span class="player-udise pending" title="UDISE Pending">✗</span>';
                        return `
                        <div class="player-card">
                            <span class="player-num">${index + 1}</span>
                            <span class="player-name">${player.name || player}</span>
                            ${player.class ? `<span class="player-class">Class ${player.class}</span>` : ''}
                            ${udiseIcon}
                        </div>
                    `}).join('') : '<p class="no-data">No players registered</p>'}
                </div>
            </div>

            <div class="view-team-section">
                <h3>📅 Upcoming Matches (${upcomingMatches.length})</h3>
                <div class="matches-list">
                    ${upcomingMatches.length > 0 ? upcomingMatches.map(match => {
                        const opponent = teams.find(t => 
                            String(t.id) === (String(match.team1_id) === String(teamId) ? String(match.team2_id) : String(match.team1_id))
                        );
                        const pool = pools.find(p => p.id === match.pool_id);
                        return `
                            <div class="match-item upcoming">
                                <span class="match-num">Match ${match.match_number || '-'}</span>
                                <span class="match-vs">vs ${opponent ? opponent.school_name : 'TBD'}</span>
                                ${pool ? `<span class="match-pool">${pool.name}</span>` : ''}
                            </div>
                        `;
                    }).join('') : '<p class="no-data">No upcoming matches scheduled</p>'}
                </div>
            </div>

            <div class="view-team-section">
                <h3>🏆 Past Matches (${pastMatches.length})</h3>
                <div class="matches-list">
                    ${pastMatches.length > 0 ? pastMatches.map(match => {
                        const opponent = teams.find(t => 
                            String(t.id) === (String(match.team1_id) === String(teamId) ? String(match.team2_id) : String(match.team1_id))
                        );
                        const won = String(match.winner_id) === String(teamId);
                        return `
                            <div class="match-item ${won ? 'won' : 'lost'}">
                                <span class="match-num">Match ${match.match_number || '-'}</span>
                                <span class="match-vs">vs ${opponent ? opponent.school_name : 'Unknown'}</span>
                                <span class="match-score">${match.score || '0 - 0'}</span>
                                <span class="match-result">${won ? '🏆 WON' : '❌ LOST'}</span>
                            </div>
                        `;
                    }).join('') : '<p class="no-data">No past matches</p>'}
                </div>
            </div>
        `;

        viewTeamModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeViewTeamModal() {
        viewTeamModal.classList.remove("show");
        document.body.style.overflow = "";
    }

    // Close view team modal events
    if (closeViewTeamModalBtn) {
        closeViewTeamModalBtn.addEventListener("click", closeViewTeamModal);
    }
    if (viewTeamModal) {
        viewTeamModal.addEventListener("click", (e) => {
            if (e.target === viewTeamModal) {
                closeViewTeamModal();
            }
        });
    }

    function openEditModal(id) {
        if (!hasPermission('teams', 'edit')) {
            showNotification("You don't have permission to edit teams", "error");
            return;
        }
        
        const team = teams.find(t => String(t.id) === String(id));
        if (!team) return;

        currentEditId = id;
        document.getElementById("editSchoolName").value = team.school_name;
        document.getElementById("editCoachName").value = team.coach_name;
        document.getElementById("editCoachNumber").value = team.coach_number;
        document.getElementById("editTeamType").value = team.team_type;

        // Generate player fields
        generateEditPlayerFields(team.players || []);

        modal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function generateEditPlayerFields(players) {
        const container = document.getElementById("editPlayersContainer");
        if (!container) return;

        let html = '';
        for (let i = 1; i <= 12; i++) {
            const player = players[i - 1] || {};
            html += `
                <div class="edit-player-item" data-player="${i}">
                    <div class="edit-player-header">
                        <h4>Player ${i}</h4>
                        <div class="edit-player-number">${i}</div>
                    </div>
                    <div class="edit-player-fields">
                        <label>
                            Name *
                            <input type="text" name="editPlayer${i}_name" value="${player.name || ''}" placeholder="Full name" required>
                        </label>
                        <label>
                            Father's Name *
                            <input type="text" name="editPlayer${i}_father" value="${player.father_name || ''}" placeholder="Father's name" required>
                        </label>
                        <label>
                            Aadhaar No. *
                            <input type="text" name="editPlayer${i}_aadhaar" value="${player.aadhaar || ''}" placeholder="12-digit" maxlength="12" required>
                        </label>
                        <label>
                            Class *
                            <select name="editPlayer${i}_class" required>
                                <option value="">Select</option>
                                <option value="6" ${player.class === '6' || player.class === 6 ? 'selected' : ''}>Class 6</option>
                                <option value="7" ${player.class === '7' || player.class === 7 ? 'selected' : ''}>Class 7</option>
                                <option value="8" ${player.class === '8' || player.class === 8 ? 'selected' : ''}>Class 8</option>
                                <option value="9" ${player.class === '9' || player.class === 9 ? 'selected' : ''}>Class 9</option>
                                <option value="10" ${player.class === '10' || player.class === 10 ? 'selected' : ''}>Class 10</option>
                                <option value="11" ${player.class === '11' || player.class === 11 ? 'selected' : ''}>Class 11</option>
                                <option value="12" ${player.class === '12' || player.class === 12 ? 'selected' : ''}>Class 12</option>
                            </select>
                        </label>
                        <label>
                            DOB *
                            <input type="date" name="editPlayer${i}_dob" value="${player.dob || ''}" required>
                        </label>
                        <label>
                            PEN No.
                            <input type="text" name="editPlayer${i}_pen" value="${player.pen || ''}" placeholder="PEN">
                        </label>
                        <label>
                            UDISE
                            <select name="editPlayer${i}_udise">
                                <option value="">Select</option>
                                <option value="verified" ${player.udise_status === 'verified' ? 'selected' : ''}>Verified</option>
                                <option value="pending" ${player.udise_status === 'pending' ? 'selected' : ''}>Pending</option>
                                <option value="not_applicable" ${player.udise_status === 'not_applicable' ? 'selected' : ''}>N/A</option>
                            </select>
                        </label>
                    </div>
                </div>
            `;
        }
        container.innerHTML = html;
    }

    function extractEditPlayerData() {
        const players = [];
        for (let i = 1; i <= 12; i++) {
            const name = document.querySelector(`input[name="editPlayer${i}_name"]`)?.value?.trim() || '';
            const father = document.querySelector(`input[name="editPlayer${i}_father"]`)?.value?.trim() || '';
            const aadhaar = document.querySelector(`input[name="editPlayer${i}_aadhaar"]`)?.value?.trim() || '';
            const playerClass = document.querySelector(`select[name="editPlayer${i}_class"]`)?.value || '';
            const dob = document.querySelector(`input[name="editPlayer${i}_dob"]`)?.value || '';
            const pen = document.querySelector(`input[name="editPlayer${i}_pen"]`)?.value?.trim() || '';
            const udise = document.querySelector(`select[name="editPlayer${i}_udise"]`)?.value || '';
            
            players.push({
                name,
                father_name: father,
                aadhaar,
                class: playerClass,
                dob,
                pen,
                udise_status: udise
            });
        }
        return players;
    }

    function closeEditModal() {
        modal.classList.remove("show");
        document.body.style.overflow = "";
        currentEditId = null;
    }

    function openDeleteModal(id) {
        if (!hasPermission('teams', 'delete')) {
            showNotification("You don't have permission to delete teams", "error");
            return;
        }
        
        const team = teams.find(t => String(t.id) === String(id));
        if (!team) return;

        currentDeleteId = id;
        document.getElementById("deleteTeamName").textContent = team.school_name;
        deleteModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeDeleteModal() {
        deleteModal.classList.remove("show");
        document.body.style.overflow = "";
        currentDeleteId = null;
    }

    // Team form handlers
    document.getElementById("editForm").addEventListener("submit", async (e) => {
        e.preventDefault();

        // Permission check
        if (!hasPermission('teams', 'edit')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeEditModal();
            return;
        }

        const players = extractEditPlayerData();

        const teamData = {
            school_name: document.getElementById("editSchoolName").value.trim(),
            coach_name: document.getElementById("editCoachName").value.trim(),
            coach_number: document.getElementById("editCoachNumber").value.trim(),
            player_count: 12,
            team_type: document.getElementById("editTeamType").value,
            players: players
        };

        const success = await updateTeam(currentEditId, teamData);
        if (success) {
            closeEditModal();
            teams = await getTeams();
            applyFilter();
        }
    });

    document.getElementById("confirmDeleteBtn").addEventListener("click", async () => {
        // Permission check
        if (!hasPermission('teams', 'delete')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeDeleteModal();
            return;
        }
        
        const success = await deleteTeam(currentDeleteId);
        if (success) {
            closeDeleteModal();
            teams = await getTeams();
            applyFilter();
        }
    });

    document.getElementById("closeModal").addEventListener("click", closeEditModal);
    document.getElementById("cancelEdit").addEventListener("click", closeEditModal);
    document.getElementById("closeDeleteModal").addEventListener("click", closeDeleteModal);
    document.getElementById("cancelDeleteBtn").addEventListener("click", closeDeleteModal);

    modal.addEventListener("click", (e) => {
        if (e.target === modal) closeEditModal();
    });
    deleteModal.addEventListener("click", (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });

    function applyFilter() {
        const value = filterEl.value;
        const filtered = teams.filter(team => team.team_type === value);
        renderTeams(filtered);
    }

    filterEl.addEventListener("change", () => {
        saveToStorage('selectedFilter', filterEl.value);
        applyFilter();
        loadPools();
        loadMatches();
    });

    // ==================== POOL FUNCTIONS ====================

    async function loadPools() {
        const teamType = filterEl.value;
        pools = await getPools(teamType);
        console.log("Loaded pools:", pools);
        console.log("Current teams:", teams);
        renderPools();
    }

    function renderPools() {
        poolGrid.innerHTML = "";

        if (!pools || !pools.length) {
            poolEmptyState.hidden = false;
            return;
        }

        poolEmptyState.hidden = true;
        const teamType = filterEl.value;
        const filteredTeams = teams.filter(t => t.team_type === teamType);
        console.log("Filtered teams for display:", filteredTeams);
        
        const canFixMatch = hasPermission('pools', 'fixMatch');
        const canEdit = hasPermission('pools', 'edit');
        const canDelete = hasPermission('pools', 'delete');

        pools.forEach(pool => {
            console.log("Processing pool:", pool.name, "team_ids:", pool.team_ids, "type:", typeof pool.team_ids);
            
            // Keep team_ids as strings for comparison
            const teamIdsArray = pool.team_ids || [];
            console.log("Team IDs array:", teamIdsArray);
            
            const poolTeams = teamIdsArray.map(id => {
                // Convert both to strings for comparison
                const found = filteredTeams.find(t => String(t.id) === String(id));
                console.log(`Looking for team with id ${id}, found:`, found);
                return found;
            }).filter(Boolean);
            
            console.log("Pool teams found:", poolTeams);

            const card = document.createElement("div");
            card.className = "pool-card";
            card.innerHTML = `
                <div class="pool-header">
                    <h3>${pool.name}</h3>
                    <div class="pool-actions">
                        ${canFixMatch ? `<button class="btn-icon fix-match-btn" data-id="${pool.id}" title="Fix Matches">⚔️</button>` : ''}
                        ${canEdit ? `<button class="btn-icon edit-pool-btn" data-id="${pool.id}" title="Edit">✏️</button>` : ''}
                        ${canDelete ? `<button class="btn-icon delete-pool-btn" data-id="${pool.id}" title="Delete">🗑️</button>` : ''}
                    </div>
                </div>
                <div class="pool-teams">
                    ${poolTeams.length > 0 ? poolTeams.map(t => `
                        <div class="pool-team-item">
                            <span>🏫</span>
                            <span>${t.school_name}</span>
                        </div>
                    `).join('') : '<p class="text-muted">No teams in pool</p>'}
                </div>
                <div class="pool-footer">
                    <span class="team-count">${poolTeams.length} teams</span>
                </div>
            `;
            poolGrid.appendChild(card);
        });

        // Attach event listeners - use poolGrid to be specific
        poolGrid.querySelectorAll(".fix-match-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!hasPermission('pools', 'fixMatch')) {
                    showNotification("You don't have permission to fix matches", "error");
                    return;
                }
                const id = parseInt(e.currentTarget.dataset.id);
                openFixMatchModal(id);
            });
        });

        poolGrid.querySelectorAll(".edit-pool-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!hasPermission('pools', 'edit')) {
                    showNotification("You don't have permission to edit pools", "error");
                    return;
                }
                const id = parseInt(e.currentTarget.dataset.id);
                openEditPoolModal(id);
            });
        });

        poolGrid.querySelectorAll(".delete-pool-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (!hasPermission('pools', 'delete')) {
                    showNotification("You don't have permission to delete pools", "error");
                    return;
                }
                const id = parseInt(e.currentTarget.dataset.id);
                openDeletePoolModal(id);
            });
        });
    }

    function openPoolModal() {
        if (!hasPermission('pools', 'add')) {
            showNotification("You don't have permission to create pools", "error");
            return;
        }
        
        const teamType = filterEl.value;
        const filteredTeams = teams.filter(t => t.team_type === teamType);
        
        console.log("Opening pool modal. Teams available:", filteredTeams.map(t => ({ id: t.id, name: t.school_name })));
        
        const checkboxContainer = document.getElementById("teamCheckboxes");
        checkboxContainer.innerHTML = filteredTeams.map((team, index) => `
            <label class="checkbox-item">
                <input type="checkbox" value="${team.id}" name="poolTeam" data-index="${index}">
                <span>${team.school_name} (ID: ${team.id})</span>
            </label>
        `).join('');

        document.getElementById("poolName").value = "";
        poolModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closePoolModal() {
        poolModal.classList.remove("show");
        document.body.style.overflow = "";
    }

    function openEditPoolModal(id) {
        if (!hasPermission('pools', 'edit')) {
            showNotification("You don't have permission to edit pools", "error");
            return;
        }
        
        const pool = pools.find(p => p.id === id);
        if (!pool) return;

        currentPoolId = id;
        const teamType = filterEl.value;
        const filteredTeams = teams.filter(t => t.team_type === teamType);
        
        // Keep team_ids as strings for comparison
        const teamIdsArray = pool.team_ids || [];
        
        const checkboxContainer = document.getElementById("editTeamCheckboxes");
        checkboxContainer.innerHTML = filteredTeams.map(team => `
            <label class="checkbox-item">
                <input type="checkbox" value="${team.id}" name="editPoolTeam" 
                    ${teamIdsArray.includes(String(team.id)) ? 'checked' : ''}>
                <span>${team.school_name}</span>
            </label>
        `).join('');

        document.getElementById("editPoolName").value = pool.name;
        editPoolModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeEditPoolModal() {
        editPoolModal.classList.remove("show");
        document.body.style.overflow = "";
        currentPoolId = null;
    }

    function openDeletePoolModal(id) {
        const pool = pools.find(p => p.id === id);
        if (!pool) return;

        currentDeletePoolId = id;
        document.getElementById("deletePoolName").textContent = pool.name;
        deletePoolModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeDeletePoolModal() {
        deletePoolModal.classList.remove("show");
        document.body.style.overflow = "";
        currentDeletePoolId = null;
    }

    function openFixMatchModal(id) {
        const pool = pools.find(p => p.id === id);
        if (!pool) return;

        currentFixMatchPoolId = id;
        document.getElementById("fixMatchPoolName").textContent = pool.name;
        
        // Get teams in this pool
        const poolTeamIds = pool.team_ids || [];
        const poolTeams = poolTeamIds.map(tid => 
            teams.find(t => String(t.id) === String(tid))
        ).filter(Boolean);
        
        // Create team selection dropdowns
        const teamSelectContainer = document.getElementById("matchTeamSelects");
        if (teamSelectContainer) {
            const teamOptions = poolTeams.map(t => 
                `<option value="${t.id}">${t.school_name}</option>`
            ).join('');
            
            teamSelectContainer.innerHTML = `
                <div class="form-group">
                    <label>Team 1</label>
                    <select id="matchTeam1" class="form-control" required>
                        <option value="">Select Team 1</option>
                        ${teamOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label>Team 2</label>
                    <select id="matchTeam2" class="form-control" required>
                        <option value="">Select Team 2</option>
                        ${teamOptions}
                    </select>
                </div>
            `;
        }
        
        fixMatchModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeFixMatchModal() {
        fixMatchModal.classList.remove("show");
        document.body.style.overflow = "";
        currentFixMatchPoolId = null;
    }

    // Pool form handlers
    document.getElementById("createPoolBtn").addEventListener("click", openPoolModal);
    document.getElementById("closePoolModal").addEventListener("click", closePoolModal);
    document.getElementById("cancelPool").addEventListener("click", closePoolModal);
    document.getElementById("closeEditPoolModal").addEventListener("click", closeEditPoolModal);
    document.getElementById("cancelEditPool").addEventListener("click", closeEditPoolModal);
    document.getElementById("closeDeletePoolModal").addEventListener("click", closeDeletePoolModal);
    document.getElementById("cancelDeletePool").addEventListener("click", closeDeletePoolModal);
    document.getElementById("closeFixMatchModal").addEventListener("click", closeFixMatchModal);
    document.getElementById("cancelFixMatch").addEventListener("click", closeFixMatchModal);

    poolModal.addEventListener("click", (e) => {
        if (e.target === poolModal) closePoolModal();
    });
    editPoolModal.addEventListener("click", (e) => {
        if (e.target === editPoolModal) closeEditPoolModal();
    });
    deletePoolModal.addEventListener("click", (e) => {
        if (e.target === deletePoolModal) closeDeletePoolModal();
    });
    fixMatchModal.addEventListener("click", (e) => {
        if (e.target === fixMatchModal) closeFixMatchModal();
    });

    document.getElementById("poolForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Permission check
        if (!hasPermission('pools', 'add')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            return;
        }
        
        const name = document.getElementById("poolName").value.trim();
        const checkboxes = document.querySelectorAll('input[name="poolTeam"]:checked');
        // Keep IDs as strings to preserve their original format
        const teamIds = Array.from(checkboxes).map(cb => cb.value);

        console.log("Creating pool with team IDs:", teamIds);

        if (teamIds.length < 2) {
            showNotification("Please select at least 2 teams", "error");
            return;
        }

        const poolData = {
            name,
            team_type: filterEl.value,
            team_ids: teamIds
        };
        console.log("Pool data to save:", poolData);

        const result = await createPool(poolData);

        if (result.success) {
            showNotification("Pool created successfully!", "success");
            logActivity('pools', 'create', result.pool?.id, `Created pool: ${name}`);
            closePoolModal();
            await loadPools();
        } else {
            console.error("Pool creation error:", result.error);
            const errorMsg = result.error?.message || "Failed to create pool. Make sure the pools table exists in Supabase.";
            showNotification(errorMsg, "error");
        }
    });

    document.getElementById("editPoolForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Permission check
        if (!hasPermission('pools', 'edit')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            return;
        }
        
        const name = document.getElementById("editPoolName").value.trim();
        const checkboxes = document.querySelectorAll('input[name="editPoolTeam"]:checked');
        // Keep IDs as strings to preserve their original format
        const teamIds = Array.from(checkboxes).map(cb => cb.value);

        if (teamIds.length < 2) {
            showNotification("Please select at least 2 teams", "error");
            return;
        }

        const result = await updatePool(currentPoolId, {
            name,
            team_ids: teamIds
        });

        if (result.success) {
            showNotification("Pool updated successfully!", "success");
            logActivity('pools', 'update', currentPoolId, `Updated pool: ${name}`);
            closeEditPoolModal();
            await loadPools();
        } else {
            showNotification("Failed to update pool", "error");
        }
    });

    document.getElementById("confirmDeletePool").addEventListener("click", async () => {
        // Permission check
        if (!hasPermission('pools', 'delete')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeDeletePoolModal();
            return;
        }
        
        // First delete all matches for this pool
        await deleteMatchesByPool(currentDeletePoolId);
        
        const success = await deletePool(currentDeletePoolId);
        if (success) {
            showNotification("Pool deleted successfully!", "success");
            logActivity('pools', 'delete', currentDeletePoolId, `Deleted pool`);
            closeDeletePoolModal();
            await loadPools();
            await loadMatches();
        } else {
            showNotification("Failed to delete pool", "error");
        }
    });

    document.getElementById("confirmFixMatch").addEventListener("click", async () => {
        // Permission check
        if (!hasPermission('pools', 'fixMatch')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeFixMatchModal();
            return;
        }
        
        const pool = pools.find(p => p.id === currentFixMatchPoolId);
        if (!pool) return;

        const team1Id = document.getElementById("matchTeam1")?.value;
        const team2Id = document.getElementById("matchTeam2")?.value;
        
        if (!team1Id || !team2Id) {
            showNotification("Please select both teams", "error");
            return;
        }
        
        if (team1Id === team2Id) {
            showNotification("Please select different teams", "error");
            return;
        }

        const result = await createMatch({
            pool_id: currentFixMatchPoolId,
            team1_id: team1Id,
            team2_id: team2Id,
            team_type: pool.team_type,
            status: 'upcoming'
        });

        if (result.success) {
            showNotification("Match created successfully!", "success");
            const team1 = teams.find(t => String(t.id) === String(team1Id));
            const team2 = teams.find(t => String(t.id) === String(team2Id));
            logActivity('matches', 'create', result.match?.id, `Created match: ${team1?.school_name || 'Team 1'} vs ${team2?.school_name || 'Team 2'}`);
            closeFixMatchModal();
            await loadMatches();
            // Switch to matches tab
            switchToTab('matches');
        } else {
            showNotification("Failed to create match", "error");
        }
    });

    // ==================== MATCH FUNCTIONS ====================
    const pastMatchList = document.getElementById("pastMatchList");
    const pastMatchEmptyState = document.getElementById("pastMatchEmptyState");
    let upcomingMatches = [];
    let pastMatches = [];

    async function loadMatches() {
        const teamType = filterEl.value;
        const allMatches = await getMatches(teamType);
        upcomingMatches = allMatches.filter(m => m.status === 'upcoming' || m.status === 'ongoing');
        pastMatches = allMatches.filter(m => m.status === 'completed');
        matches = allMatches; // Keep for other functions
        renderUpcomingMatches();
        renderPastMatches();
    }

    function renderUpcomingMatches() {
        matchList.innerHTML = "";

        if (!upcomingMatches || !upcomingMatches.length) {
            matchEmptyState.hidden = false;
            return;
        }

        matchEmptyState.hidden = true;
        const teamType = filterEl.value;
        const filteredTeams = teams.filter(t => t.team_type === teamType);
        
        const canReorder = hasPermission('matches', 'reorder');
        const canComplete = hasPermission('matches', 'complete');
        const canDelete = hasPermission('matches', 'delete');

        // Sort by match_order for display order
        const sortedMatches = [...upcomingMatches].sort((a, b) => (a.match_order || 0) - (b.match_order || 0));

        sortedMatches.forEach((match, index) => {
            const team1 = filteredTeams.find(t => String(t.id) === String(match.team1_id));
            const team2 = filteredTeams.find(t => String(t.id) === String(match.team2_id));
            const pool = pools.find(p => p.id === match.pool_id);
            // Use stored match_number (permanent) - never recalculate
            const matchNumber = match.match_number || match.match_order || '-';

            const matchItem = document.createElement("div");
            matchItem.className = `match-item ${match.status}`;
            matchItem.draggable = canReorder;
            matchItem.dataset.id = match.id;
            matchItem.dataset.order = match.match_order;

            matchItem.innerHTML = `
                ${canReorder ? '<div class="match-drag-handle" title="Drag to reorder">⋮⋮</div>' : ''}
                <div class="match-order">Match #${matchNumber}</div>
                <div class="match-details">
                    <div class="match-teams">
                        <span class="team-name">${team1 ? team1.school_name : 'Unknown'}</span>
                        <span class="vs">VS</span>
                        <span class="team-name">${team2 ? team2.school_name : 'Unknown'}</span>
                    </div>
                    <div class="match-info">
                        <span class="pool-badge">${pool ? pool.name : 'Unknown Pool'}</span>
                        <span class="status-badge ${match.status}">${match.status}</span>
                    </div>
                </div>
                <div class="match-actions">
                    ${canComplete ? `<button class="btn-icon complete-match-btn" data-id="${match.id}" title="Mark Complete">✅</button>` : ''}
                    ${canDelete ? `<button class="btn-icon delete-match-btn" data-id="${match.id}" title="Delete">🗑️</button>` : ''}
                </div>
            `;

            // Drag events (only if user has reorder permission)
            if (canReorder) {
                matchItem.addEventListener("dragstart", handleDragStart);
                matchItem.addEventListener("dragend", handleDragEnd);
                matchItem.addEventListener("dragover", handleDragOver);
                matchItem.addEventListener("drop", handleDrop);
            }

            matchList.appendChild(matchItem);
        });

        // Button event listeners for upcoming matches
        matchList.querySelectorAll(".complete-match-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                if (!hasPermission('matches', 'complete')) {
                    showNotification("You don't have permission to complete matches", "error");
                    return;
                }
                const id = parseInt(e.currentTarget.dataset.id);
                openCompleteMatchModal(id);
            });
        });

        matchList.querySelectorAll(".delete-match-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                if (!hasPermission('matches', 'delete')) {
                    showNotification("You don't have permission to delete matches", "error");
                    return;
                }
                const id = parseInt(e.currentTarget.dataset.id);
                if (confirm("Delete this match?")) {
                    const success = await deleteMatch(id);
                    if (success) {
                        showNotification("Match deleted!", "success");
                        await loadMatches();
                    }
                }
            });
        });
    }

    function renderPastMatches() {
        if (!pastMatchList) return;
        pastMatchList.innerHTML = "";

        if (!pastMatches || !pastMatches.length) {
            if (pastMatchEmptyState) pastMatchEmptyState.hidden = false;
            return;
        }

        if (pastMatchEmptyState) pastMatchEmptyState.hidden = true;
        const teamType = filterEl.value;
        const filteredTeams = teams.filter(t => t.team_type === teamType);

        // Sort by most recent
        const sortedMatches = [...pastMatches].sort((a, b) => 
            new Date(b.updated_at || b.created_at) - new Date(a.updated_at || a.created_at)
        );

        const canEditPastMatch = hasPermission('matches', 'edit');
        const canDeletePastMatch = hasPermission('matches', 'delete');

        sortedMatches.forEach((match) => {
            const team1 = filteredTeams.find(t => String(t.id) === String(match.team1_id));
            const team2 = filteredTeams.find(t => String(t.id) === String(match.team2_id));
            const pool = pools.find(p => p.id === match.pool_id);
            const winner = filteredTeams.find(t => String(t.id) === String(match.winner_id));
            const scores = match.score ? match.score.split(' - ') : ['0', '0'];
            const matchNumber = match.match_number || match.match_order || '-';

            const matchItem = document.createElement("div");
            matchItem.className = "match-item completed";
            matchItem.dataset.id = match.id;

            matchItem.innerHTML = `
                <div class="match-number-badge">Match #${matchNumber}</div>
                <div class="match-winner-badge">🏆</div>
                <div class="match-details">
                    <div class="match-teams">
                        <span class="team-name ${String(match.winner_id) === String(match.team1_id) ? 'winner' : ''}">${team1 ? team1.school_name : 'Unknown'}</span>
                        <span class="match-score">${scores[0]} - ${scores[1]}</span>
                        <span class="team-name ${String(match.winner_id) === String(match.team2_id) ? 'winner' : ''}">${team2 ? team2.school_name : 'Unknown'}</span>
                    </div>
                    <div class="match-info">
                        <span class="pool-badge">${pool ? pool.name : 'Unknown Pool'}</span>
                        <span class="winner-text">Winner: ${winner ? winner.school_name : 'Unknown'}</span>
                    </div>
                </div>
                <div class="match-actions">
                    ${canEditPastMatch ? `<button class="btn-icon edit-past-match-btn" data-id="${match.id}" title="Edit">✏️</button>` : ''}
                    ${canDeletePastMatch ? `<button class="btn-icon delete-match-btn" data-id="${match.id}" title="Delete">🗑️</button>` : ''}
                </div>
            `;

            pastMatchList.appendChild(matchItem);
        });

        // Button event listeners for past matches
        pastMatchList.querySelectorAll(".edit-past-match-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                if (!hasPermission('matches', 'edit')) {
                    showNotification("You don't have permission to edit matches", "error");
                    return;
                }
                const id = parseInt(e.currentTarget.dataset.id);
                openEditPastMatchModal(id);
            });
        });

        pastMatchList.querySelectorAll(".delete-match-btn").forEach(btn => {
            btn.addEventListener("click", async (e) => {
                if (!hasPermission('matches', 'delete')) {
                    showNotification("You don't have permission to delete matches", "error");
                    return;
                }
                const id = parseInt(e.currentTarget.dataset.id);
                if (confirm("Delete this match?")) {
                    const success = await deleteMatch(id);
                    if (success) {
                        showNotification("Match deleted!", "success");
                        await loadMatches();
                    }
                }
            });
        });
    }

    // ==================== COMPLETE MATCH FUNCTIONS ====================
    let currentCompleteMatchId = null;
    const completeMatchModal = document.getElementById("completeMatchModal");

    function openCompleteMatchModal(id) {
        const match = matches.find(m => m.id === id);
        if (!match) return;

        currentCompleteMatchId = id;
        const team1 = teams.find(t => String(t.id) === String(match.team1_id));
        const team2 = teams.find(t => String(t.id) === String(match.team2_id));

        document.getElementById("winnerSelect").innerHTML = `
            <option value="">Select Winner</option>
            <option value="${match.team1_id}">${team1 ? team1.school_name : 'Team 1'}</option>
            <option value="${match.team2_id}">${team2 ? team2.school_name : 'Team 2'}</option>
        `;
        document.getElementById("team1ScoreInput").value = "";
        document.getElementById("team2ScoreInput").value = "";
        document.getElementById("team1ScoreLabel").textContent = team1 ? team1.school_name : 'Team 1';
        document.getElementById("team2ScoreLabel").textContent = team2 ? team2.school_name : 'Team 2';

        completeMatchModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeCompleteMatchModal() {
        completeMatchModal.classList.remove("show");
        document.body.style.overflow = "";
        currentCompleteMatchId = null;
    }

    document.getElementById("closeCompleteMatchModal")?.addEventListener("click", closeCompleteMatchModal);
    document.getElementById("cancelCompleteMatch")?.addEventListener("click", closeCompleteMatchModal);
    completeMatchModal?.addEventListener("click", (e) => {
        if (e.target === completeMatchModal) closeCompleteMatchModal();
    });

    document.getElementById("completeMatchForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Permission check
        if (!hasPermission('matches', 'complete')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeCompleteMatchModal();
            return;
        }

        const winnerId = document.getElementById("winnerSelect").value;
        const team1Score = document.getElementById("team1ScoreInput").value;
        const team2Score = document.getElementById("team2ScoreInput").value;

        if (!winnerId) {
            showNotification("Please select a winner", "error");
            return;
        }

        const score = `${team1Score} - ${team2Score}`;
        const result = await completeMatch(currentCompleteMatchId, winnerId, score);

        if (result.success) {
            showNotification("Match marked as completed!", "success");
            const match = matches.find(m => m.id === currentCompleteMatchId);
            const winner = teams.find(t => String(t.id) === String(winnerId));
            logActivity('matches', 'update', currentCompleteMatchId, `Completed match - Winner: ${winner?.school_name || 'Unknown'}, Score: ${score}`);
            closeCompleteMatchModal();
            await loadMatches();
        } else {
            showNotification("Failed to complete match", "error");
        }
    });

    // ==================== EDIT PAST MATCH FUNCTIONS ====================
    let currentEditPastMatchId = null;
    const editPastMatchModal = document.getElementById("editPastMatchModal");

    function openEditPastMatchModal(id) {
        const match = matches.find(m => m.id === id);
        if (!match) return;

        currentEditPastMatchId = id;
        const team1 = teams.find(t => String(t.id) === String(match.team1_id));
        const team2 = teams.find(t => String(t.id) === String(match.team2_id));
        const scores = match.score ? match.score.split(' - ') : ['0', '0'];

        document.getElementById("editMatchNumber").value = match.match_number || match.match_order || 1;
        document.getElementById("editWinnerSelect").innerHTML = `
            <option value="">Select Winner</option>
            <option value="${match.team1_id}" ${String(match.winner_id) === String(match.team1_id) ? 'selected' : ''}>${team1 ? team1.school_name : 'Team 1'}</option>
            <option value="${match.team2_id}" ${String(match.winner_id) === String(match.team2_id) ? 'selected' : ''}>${team2 ? team2.school_name : 'Team 2'}</option>
        `;
        document.getElementById("editTeam1ScoreInput").value = scores[0] ? scores[0].trim() : "0";
        document.getElementById("editTeam2ScoreInput").value = scores[1] ? scores[1].trim() : "0";
        document.getElementById("editTeam1ScoreLabel").textContent = team1 ? team1.school_name + ' Score' : 'Team 1 Score';
        document.getElementById("editTeam2ScoreLabel").textContent = team2 ? team2.school_name + ' Score' : 'Team 2 Score';

        editPastMatchModal.classList.add("show");
        document.body.style.overflow = "hidden";
    }

    function closeEditPastMatchModal() {
        editPastMatchModal.classList.remove("show");
        document.body.style.overflow = "";
        currentEditPastMatchId = null;
    }

    document.getElementById("closeEditPastMatchModal")?.addEventListener("click", closeEditPastMatchModal);
    document.getElementById("cancelEditPastMatch")?.addEventListener("click", closeEditPastMatchModal);
    editPastMatchModal?.addEventListener("click", (e) => {
        if (e.target === editPastMatchModal) closeEditPastMatchModal();
    });

    document.getElementById("editPastMatchForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();

        // Permission check
        if (!hasPermission('matches', 'edit')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeEditPastMatchModal();
            return;
        }

        const matchNumber = parseInt(document.getElementById("editMatchNumber").value);
        const winnerId = document.getElementById("editWinnerSelect").value;
        const team1Score = document.getElementById("editTeam1ScoreInput").value;
        const team2Score = document.getElementById("editTeam2ScoreInput").value;

        if (!winnerId) {
            showNotification("Please select a winner", "error");
            return;
        }

        const score = `${team1Score} - ${team2Score}`;
        const result = await updatePastMatch(currentEditPastMatchId, {
            match_number: matchNumber,
            winner_id: winnerId,
            score: score
        });

        if (result.success) {
            showNotification("Match updated successfully!", "success");
            logActivity('matches', 'update', currentEditPastMatchId, `Updated match #${matchNumber} result: ${score}`);
            closeEditPastMatchModal();
            await loadMatches();
        } else {
            showNotification("Failed to update match", "error");
        }
    });

    // Drag and drop handlers
    function handleDragStart(e) {
        draggedMatch = e.target;
        e.target.classList.add("dragging");
        e.dataTransfer.effectAllowed = "move";
    }

    function handleDragEnd(e) {
        e.target.classList.remove("dragging");
        draggedMatch = null;
    }

    function handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "move";
        
        const afterElement = getDragAfterElement(matchList, e.clientY);
        if (afterElement == null) {
            matchList.appendChild(draggedMatch);
        } else {
            matchList.insertBefore(draggedMatch, afterElement);
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        // Update visual order numbers
        const items = matchList.querySelectorAll(".match-item");
        // Calculate starting number based on completed matches
        const maxCompletedMatchNumber = pastMatches.length > 0 
            ? Math.max(...pastMatches.map(m => m.match_number || m.match_order || 0))
            : 0;
        items.forEach((item, index) => {
            const orderEl = item.querySelector(".match-order");
            if (orderEl) orderEl.textContent = `Match #${maxCompletedMatchNumber + index + 1}`;
        });
    }

    // Save button handler
    document.getElementById("saveMatchOrder")?.addEventListener("click", async () => {
        const items = matchList.querySelectorAll(".match-item");
        if (!items.length) {
            showNotification("No matches to save", "error");
            return;
        }
        
        // Get the highest match_number from completed matches to continue from there
        const maxCompletedMatchNumber = pastMatches.length > 0 
            ? Math.max(...pastMatches.map(m => m.match_number || m.match_order || 0))
            : 0;
        
        const updates = [];
        items.forEach((item, index) => {
            const matchId = parseInt(item.dataset.id);
            // New match number starts after the highest completed match number
            const newMatchNumber = maxCompletedMatchNumber + index + 1;
            updates.push({ id: matchId, order: index + 1, matchNumber: newMatchNumber });
        });

        let success = true;
        for (const update of updates) {
            const result = await updateMatchOrder(update.id, update.order, update.matchNumber);
            if (!result) success = false;
        }

        if (success) {
            showNotification("Match order saved successfully!", "success");
            logActivity('matches', 'reorder', null, 'Reordered upcoming matches');
            await loadMatches(); // Reload to show updated numbers
        } else {
            showNotification("Failed to save order", "error");
        }
    });

    function getDragAfterElement(container, y) {
        const draggableElements = [...container.querySelectorAll('.match-item:not(.dragging)')];
        
        return draggableElements.reduce((closest, child) => {
            const box = child.getBoundingClientRect();
            const offset = y - box.top - box.height / 2;
            
            if (offset < 0 && offset > closest.offset) {
                return { offset: offset, element: child };
            } else {
                return closest;
            }
        }, { offset: Number.NEGATIVE_INFINITY }).element;
    }

    // ==================== USER MANAGEMENT ====================
    
    async function loadUsers() {
        if (!userGrid) return;
        
        userGrid.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading users...</p></div>';
        
        try {
            users = await getAllUsers();
            renderUsers();
        } catch (error) {
            console.error("Error loading users:", error);
            userGrid.innerHTML = '<div class="empty-state"><p>Failed to load users</p></div>';
        }
    }

    function renderUsers() {
        if (!userGrid) return;
        
        if (users.length === 0) {
            userGrid.innerHTML = '';
            if (userEmptyState) userEmptyState.hidden = false;
            return;
        }
        
        if (userEmptyState) userEmptyState.hidden = true;
        
        userGrid.innerHTML = users.map(user => {
            const permissions = user.permissions || {};
            const isMainAdmin = user.id === 1;
            
            // Count enabled permissions per module
            const countPerms = (module) => {
                if (!permissions[module]) return 0;
                return Object.values(permissions[module]).filter(v => v === true).length;
            };
            
            return `
                <div class="user-card" data-id="${user.id}">
                    <div class="user-header">
                        <div class="user-info-card">
                            <div class="user-avatar">👤</div>
                            <div>
                                <div class="user-name">${user.display_name || user.username}</div>
                                <div class="user-username">@${user.username}</div>
                            </div>
                        </div>
                        <span class="user-status ${user.is_active ? 'active' : 'inactive'}">
                            ${user.is_active ? 'Active' : 'Inactive'}
                        </span>
                    </div>
                    <span class="user-role ${user.role}">${user.role}</span>
                    <div class="user-permissions">
                        <span class="permission-badge ${countPerms('teams') > 0 ? 'enabled' : ''}">👥 Teams (${countPerms('teams')})</span>
                        <span class="permission-badge ${countPerms('pools') > 0 ? 'enabled' : ''}">🏊 Pools (${countPerms('pools')})</span>
                        <span class="permission-badge ${countPerms('matches') > 0 ? 'enabled' : ''}">⚔️ Matches (${countPerms('matches')})</span>
                        <span class="permission-badge ${countPerms('users') > 0 ? 'enabled' : ''}">👤 Users (${countPerms('users')})</span>
                    </div>
                    <div class="user-actions">
                        ${hasPermission('users', 'edit') ? `<button class="btn-edit" onclick="editUserClick(${user.id})">✏️ Edit</button>` : ''}
                        ${!isMainAdmin && hasPermission('users', 'toggleStatus') ? `
                            <button class="btn-toggle" onclick="toggleUserClick(${user.id}, ${!user.is_active})">
                                ${user.is_active ? '🔒 Disable' : '🔓 Enable'}
                            </button>
                        ` : ''}
                        ${!isMainAdmin && hasPermission('users', 'delete') ? `<button class="btn-delete" onclick="deleteUserClick(${user.id}, '${user.username}')">🗑️</button>` : ''}
                    </div>
                </div>
            `;
        }).join('');
    }

    // ==================== PERMISSIONS UI GENERATOR ====================
    function generatePermissionsUI(containerId, prefix, permissions = null) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        const schema = getPermissionSchema();
        const role = document.getElementById(prefix === 'new' ? 'newRole' : 'editRole')?.value || 'editor';
        const defaultPerms = permissions || getDefaultPermissions(role);
        
        let html = '';
        
        for (const [module, config] of Object.entries(schema)) {
            const modulePerms = defaultPerms[module] || {};
            
            html += `
                <div class="permission-module" data-module="${module}">
                    <div class="permission-module-header" onclick="toggleModulePermissions('${prefix}', '${module}')">
                        <span class="module-name">${config.label}</span>
                        <button type="button" class="toggle-all-btn">Toggle All</button>
                    </div>
                    <div class="permission-actions">
            `;
            
            for (const [action, label] of Object.entries(config.actions)) {
                const checked = modulePerms[action] === true ? 'checked' : '';
                const checkedClass = modulePerms[action] === true ? 'checked' : '';
                
                html += `
                    <label class="permission-action ${checkedClass}">
                        <input type="checkbox" 
                            id="${prefix}_${module}_${action}" 
                            name="${prefix}_${module}_${action}"
                            ${checked}
                            onchange="updatePermissionStyle(this)">
                        ${label}
                    </label>
                `;
            }
            
            html += `
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    // Toggle all permissions in a module
    window.toggleModulePermissions = function(prefix, module) {
        const schema = getPermissionSchema();
        const actions = Object.keys(schema[module].actions);
        
        // Check if all are currently checked
        const checkboxes = actions.map(action => 
            document.getElementById(`${prefix}_${module}_${action}`)
        ).filter(cb => cb);
        
        const allChecked = checkboxes.every(cb => cb.checked);
        
        // Toggle all
        checkboxes.forEach(cb => {
            cb.checked = !allChecked;
            updatePermissionStyle(cb);
        });
    };
    
    // Update visual style when checkbox changes
    window.updatePermissionStyle = function(checkbox) {
        const label = checkbox.closest('.permission-action');
        if (label) {
            label.classList.toggle('checked', checkbox.checked);
        }
    };
    
    // Collect permissions from UI
    function collectPermissionsFromUI(prefix) {
        const schema = getPermissionSchema();
        const permissions = {};
        
        for (const module of Object.keys(schema)) {
            permissions[module] = {};
            for (const action of Object.keys(schema[module].actions)) {
                const checkbox = document.getElementById(`${prefix}_${module}_${action}`);
                permissions[module][action] = checkbox ? checkbox.checked : false;
            }
        }
        
        return permissions;
    }

    // Create User Modal
    function openUserModal() {
        if (!userModal) return;
        document.getElementById("newUsername").value = '';
        document.getElementById("newPassword").value = '';
        document.getElementById("newDisplayName").value = '';
        document.getElementById("newRole").value = 'editor';
        
        // Generate permissions UI with default editor permissions
        generatePermissionsUI('newPermissionsGrid', 'new', getDefaultPermissions('editor'));
        
        userModal.classList.add("show");
    }

    function closeUserModal() {
        if (userModal) userModal.classList.remove("show");
    }
    
    // Update permissions when role changes
    document.getElementById("newRole")?.addEventListener("change", (e) => {
        generatePermissionsUI('newPermissionsGrid', 'new', getDefaultPermissions(e.target.value));
    });

    document.getElementById("createUserBtn")?.addEventListener("click", openUserModal);
    document.getElementById("closeUserModal")?.addEventListener("click", closeUserModal);
    document.getElementById("cancelUser")?.addEventListener("click", closeUserModal);

    document.getElementById("userForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Permission check
        if (!hasPermission('users', 'add')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeUserModal();
            return;
        }
        
        const userData = {
            username: document.getElementById("newUsername").value.trim(),
            password: document.getElementById("newPassword").value,
            display_name: document.getElementById("newDisplayName").value.trim() || null,
            role: document.getElementById("newRole").value,
            permissions: collectPermissionsFromUI('new')
        };

        const result = await createUser(userData);
        
        if (result.success) {
            showNotification("User created successfully!", "success");
            logActivity('users', 'create', result.user?.id, `Created user: @${userData.username} (${userData.role})`);
            closeUserModal();
            loadUsers();
        } else {
            showNotification(result.error || "Failed to create user", "error");
        }
    });

    // Edit User Modal
    window.editUserClick = function(userId) {
        const user = users.find(u => u.id === userId);
        if (!user || !editUserModal) return;
        
        currentEditUserId = userId;
        document.getElementById("editUserId").value = userId;
        document.getElementById("editUsername").value = user.username;
        document.getElementById("editPassword").value = '';
        document.getElementById("editDisplayName").value = user.display_name || '';
        document.getElementById("editRole").value = user.role;
        
        // Generate permissions UI with user's current permissions
        generatePermissionsUI('editPermissionsGrid', 'edit', user.permissions || getDefaultPermissions(user.role));
        
        // Disable role change for main admin
        document.getElementById("editRole").disabled = userId === 1;
        
        editUserModal.classList.add("show");
    };
    
    // Update permissions when role changes in edit modal
    document.getElementById("editRole")?.addEventListener("change", (e) => {
        generatePermissionsUI('editPermissionsGrid', 'edit', getDefaultPermissions(e.target.value));
    });

    function closeEditUserModal() {
        if (editUserModal) editUserModal.classList.remove("show");
        currentEditUserId = null;
    }

    document.getElementById("closeEditUserModal")?.addEventListener("click", closeEditUserModal);
    document.getElementById("cancelEditUser")?.addEventListener("click", closeEditUserModal);

    document.getElementById("editUserForm")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        
        // Permission check
        if (!hasPermission('users', 'edit')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeEditUserModal();
            return;
        }
        
        if (!currentEditUserId) return;
        
        const updates = {
            display_name: document.getElementById("editDisplayName").value.trim() || null,
            role: document.getElementById("editRole").value,
            permissions: collectPermissionsFromUI('edit')
        };
        
        // Only update password if provided
        const newPassword = document.getElementById("editPassword").value;
        if (newPassword) {
            updates.password = newPassword;
        }

        const result = await updateUser(currentEditUserId, updates);
        
        if (result.success) {
            showNotification("User updated successfully!", "success");
            logActivity('users', 'update', currentEditUserId, `Updated user: @${document.getElementById('editUsername').value}`);
            closeEditUserModal();
            loadUsers();
        } else {
            showNotification(result.error || "Failed to update user", "error");
        }
    });

    // Toggle User Status
    window.toggleUserClick = async function(userId, newStatus) {
        const result = await toggleUserStatus(userId, newStatus);
        
        if (result.success) {
            showNotification(`User ${newStatus ? 'enabled' : 'disabled'} successfully!`, "success");
            logActivity('users', 'update', userId, `${newStatus ? 'Enabled' : 'Disabled'} user`);
            loadUsers();
        } else {
            showNotification(result.error || "Failed to update user status", "error");
        }
    };

    // Delete User Modal
    window.deleteUserClick = function(userId, username) {
        if (!deleteUserModal) return;
        currentDeleteUserId = userId;
        document.getElementById("deleteUserName").textContent = username;
        deleteUserModal.classList.add("show");
    };

    function closeDeleteUserModal() {
        if (deleteUserModal) deleteUserModal.classList.remove("show");
        currentDeleteUserId = null;
    }

    document.getElementById("closeDeleteUserModal")?.addEventListener("click", closeDeleteUserModal);
    document.getElementById("cancelDeleteUser")?.addEventListener("click", closeDeleteUserModal);

    document.getElementById("confirmDeleteUser")?.addEventListener("click", async () => {
        if (!currentDeleteUserId) return;
        
        // Permission check
        if (!hasPermission('users', 'delete')) {
            showNotification("Permission denied. Contact admin for access.", "error");
            closeDeleteUserModal();
            return;
        }
        
        const result = await deleteUser(currentDeleteUserId);
        
        if (result.success) {
            showNotification("User deleted successfully!", "success");
            logActivity('users', 'delete', currentDeleteUserId, `Deleted user: @${document.getElementById('deleteUserName').textContent}`);
            closeDeleteUserModal();
            loadUsers();
        } else {
            showNotification(result.error || "Failed to delete user", "error");
        }
    });

    // ==================== KEYBOARD SHORTCUTS ====================
    document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
            if (modal.classList.contains("show")) closeEditModal();
            if (deleteModal.classList.contains("show")) closeDeleteModal();
            if (poolModal.classList.contains("show")) closePoolModal();
            if (editPoolModal.classList.contains("show")) closeEditPoolModal();
            if (deletePoolModal.classList.contains("show")) closeDeletePoolModal();
            if (fixMatchModal.classList.contains("show")) closeFixMatchModal();
            if (userModal?.classList.contains("show")) closeUserModal();
            if (editUserModal?.classList.contains("show")) closeEditUserModal();
            if (deleteUserModal?.classList.contains("show")) closeDeleteUserModal();
            if (searchResults && !searchResults.hidden) closeSearchResults();
        }
    });

    // ==================== SEARCH FUNCTIONALITY ====================
    function performSearch(query) {
        if (!query || query.length < 2) {
            searchResults.hidden = true;
            clearSearchBtn.hidden = true;
            return;
        }

        clearSearchBtn.hidden = false;
        const lowerQuery = query.toLowerCase();
        let matchedTeams = teams.filter(team => 
            team.school_name.toLowerCase().includes(lowerQuery) ||
            team.coach_name.toLowerCase().includes(lowerQuery)
        );

        // Sort by gender priority - teams matching selected filter come first
        const selectedGender = filterEl.value;
        matchedTeams.sort((a, b) => {
            const aMatch = a.team_type === selectedGender ? 0 : 1;
            const bMatch = b.team_type === selectedGender ? 0 : 1;
            return aMatch - bMatch;
        });

        if (matchedTeams.length === 0) {
            searchResultsContent.innerHTML = `
                <div class="no-results">
                    <p>No teams found matching "<strong>${query}</strong>"</p>
                </div>
            `;
            searchResults.hidden = false;
            return;
        }

        // Get all matches for context
        const allMatches = matches;

        searchResultsContent.innerHTML = matchedTeams.map(team => {
            const teamPool = getTeamPool(team.id);
            const pillClass = team.team_type === 'male' ? 'male' : 'female';
            const pillText = team.team_type === 'male' ? '👨 Male' : '👩 Female';

            // Find team's matches
            const teamMatches = allMatches.filter(m => 
                String(m.team1_id) === String(team.id) || 
                String(m.team2_id) === String(team.id)
            );

            const upcomingMatches = teamMatches.filter(m => m.status === 'upcoming');
            const pastMatches = teamMatches.filter(m => m.status === 'completed');

            // Render past matches
            const pastMatchesHtml = pastMatches.map(match => {
                const opponent = teams.find(t => 
                    String(t.id) === (String(match.team1_id) === String(team.id) ? String(match.team2_id) : String(match.team1_id))
                );
                const isWinner = String(match.winner_id) === String(team.id);
                const resultClass = isWinner ? 'won' : 'lost';
                const resultText = isWinner ? 'WON' : 'LOST';
                
                return `
                    <div class="match-mini ${resultClass}">
                        <div class="match-mini-teams">
                            Match ${match.match_number || '-'}: vs ${opponent ? opponent.school_name : 'Unknown'}
                        </div>
                        <span class="match-mini-result">${resultText} (${match.score || '0-0'})</span>
                    </div>
                `;
            }).join('');

            // Render upcoming matches
            const upcomingMatchesHtml = upcomingMatches.map(match => {
                const opponent = teams.find(t => 
                    String(t.id) === (String(match.team1_id) === String(team.id) ? String(match.team2_id) : String(match.team1_id))
                );
                
                return `
                    <div class="match-mini upcoming">
                        <div class="match-mini-teams">
                            Match ${match.match_number || '-'}: vs ${opponent ? opponent.school_name : 'TBD'}
                        </div>
                        <span class="match-mini-result">UPCOMING</span>
                    </div>
                `;
            }).join('');

            return `
                <div class="search-result-card" data-team-id="${team.id}">
                    <div class="search-result-header">
                        <div>
                            <h4>${team.school_name}</h4>
                            <div class="search-result-badges">
                                <span class="pill ${pillClass}">${pillText}</span>
                                ${teamPool ? `<span class="pool-badge">${teamPool}</span>` : '<span class="pool-badge-empty">No Pool</span>'}
                            </div>
                        </div>
                        <button class="view-profile-btn" data-team-id="${team.id}">👁 View Profile</button>
                    </div>
                    <div class="search-result-info">
                        <div class="info-item">
                            <label>Coach</label>
                            <span>🎯 ${team.coach_name}</span>
                        </div>
                        <div class="info-item">
                            <label>Contact</label>
                            <span>📞 ${team.coach_number}</span>
                        </div>
                        <div class="info-item">
                            <label>Players</label>
                            <span>👥 ${team.player_count} Players</span>
                        </div>
                        <div class="info-item">
                            <label>Record</label>
                            <span>🏆 ${pastMatches.filter(m => String(m.winner_id) === String(team.id)).length}W - ${pastMatches.filter(m => String(m.winner_id) !== String(team.id)).length}L</span>
                        </div>
                    </div>
                    ${pastMatches.length > 0 ? `
                        <div class="search-result-matches">
                            <h5>🏆 Past Matches (${pastMatches.length})</h5>
                            <div class="match-list-mini">${pastMatchesHtml}</div>
                        </div>
                    ` : ''}
                    ${upcomingMatches.length > 0 ? `
                        <div class="search-result-matches">
                            <h5>⚔️ Upcoming Matches (${upcomingMatches.length})</h5>
                            <div class="match-list-mini">${upcomingMatchesHtml}</div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');

        // Add click handlers for view profile buttons
        searchResultsContent.querySelectorAll('.view-profile-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const teamId = e.currentTarget.dataset.teamId;
                closeSearchPanel();
                openViewTeamModal(teamId);
            });
        });

        searchResults.hidden = false;
    }

    function closeSearchPanel() {
        searchResults.hidden = true;
        searchInput.value = '';
        clearSearchBtn.hidden = true;
    }

    // Search event listeners
    if (searchInput) {
        let searchTimeout;
        searchInput.addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                performSearch(e.target.value.trim());
            }, 300);
        });
    }

    if (clearSearchBtn) {
        clearSearchBtn.addEventListener('click', closeSearchPanel);
    }

    if (closeSearchResults) {
        closeSearchResults.addEventListener('click', closeSearchPanel);
    }

    // ==================== THEME TOGGLE ====================
    const themeToggle = document.getElementById('themeToggle');
    
    function setTheme(theme) {
        document.body.setAttribute('data-theme', theme);
        saveToStorage('theme', theme);
        
        // Update toggle button icon
        if (themeToggle) {
            themeToggle.innerHTML = theme === 'light' ? '🌙' : '☀️';
            themeToggle.title = theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode';
        }
    }

    function toggleTheme() {
        const currentTheme = document.body.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        setTheme(newTheme);
    }

    // Initialize theme from storage
    const savedTheme = getFromStorage('theme', 'dark');
    setTheme(savedTheme);

    // Theme toggle event listener
    if (themeToggle) {
        themeToggle.addEventListener('click', toggleTheme);
    }

    // ==================== SUB-TAB NAVIGATION (Users Section) ====================
    const subTabBtns = document.querySelectorAll('.sub-tab-btn');
    const subTabContents = document.querySelectorAll('.sub-tab-content');

    subTabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const subtab = btn.dataset.subtab;
            
            // Update active button
            subTabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Update active content
            subTabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === subtab) {
                    content.classList.add('active');
                }
            });
            
            // Load data for the selected sub-tab
            if (subtab === 'login-logs') {
                loadLoginLogs();
            } else if (subtab === 'activity-logs') {
                loadActivityLogs();
            }
        });
    });

    // ==================== LOGIN LOGS ====================
    let loginLogs = [];
    const loginLogsContainer = document.getElementById('loginLogsContainer');
    const loginLogFilter = document.getElementById('loginLogFilter');
    const loginLogSearch = document.getElementById('loginLogSearch');

    async function loadLoginLogs() {
        if (!loginLogsContainer) return;
        
        // Login history is available to all authenticated users
        loginLogsContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading logs...</p></div>';
        
        try {
            const result = await getLoginLogs(200);
            if (!result.success) {
                loginLogsContainer.innerHTML = `<div class="logs-empty"><div class="empty-icon">❌</div><h3>Error</h3><p>${result.error}</p></div>`;
                return;
            }
            loginLogs = result.data;
            renderLoginLogs();
        } catch (error) {
            console.error("Error loading login logs:", error);
            loginLogsContainer.innerHTML = '<div class="logs-empty"><div class="empty-icon">❌</div><p>Failed to load login logs</p></div>';
        }
    }

    function renderLoginLogs() {
        if (!loginLogsContainer) return;
        
        let filteredLogs = [...loginLogs];
        
        // Apply filter
        const filter = loginLogFilter?.value || 'all';
        if (filter === 'login') {
            filteredLogs = filteredLogs.filter(log => log.action === 'login' && log.success);
        } else if (filter === 'logout') {
            filteredLogs = filteredLogs.filter(log => log.action === 'logout');
        } else if (filter === 'failed') {
            filteredLogs = filteredLogs.filter(log => !log.success);
        }
        
        // Apply search
        const search = loginLogSearch?.value?.toLowerCase() || '';
        if (search) {
            filteredLogs = filteredLogs.filter(log => 
                log.username?.toLowerCase().includes(search)
            );
        }
        
        if (filteredLogs.length === 0) {
            loginLogsContainer.innerHTML = '<div class="logs-empty"><div class="empty-icon">📋</div><p>No login logs found</p></div>';
            return;
        }
        
        loginLogsContainer.innerHTML = `
            <table class="log-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Action</th>
                        <th>Status</th>
                        <th>Reason</th>
                        <th>IP Address</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredLogs.map(log => `
                        <tr>
                            <td class="log-timestamp">${formatLogTime(log.timestamp)}</td>
                            <td class="log-user">@${log.username || 'unknown'}</td>
                            <td>
                                <span class="log-status ${log.action}">
                                    ${log.action === 'login' ? '🔑 Login' : '🚪 Logout'}
                                </span>
                            </td>
                            <td>
                                <span class="log-status ${log.success ? 'success' : 'failed'}">
                                    ${log.success ? '✅ Success' : '❌ Failed'}
                                </span>
                            </td>
                            <td>${log.reason || '-'}</td>
                            <td>${log.ip_address || 'unknown'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Login log filter/search listeners
    loginLogFilter?.addEventListener('change', renderLoginLogs);
    loginLogSearch?.addEventListener('input', debounce(renderLoginLogs, 300));
    document.getElementById('refreshLoginLogs')?.addEventListener('click', loadLoginLogs);

    // ==================== ACTIVITY LOGS ====================
    let activityLogs = [];
    const activityLogsContainer = document.getElementById('activityLogsContainer');
    const activityModuleFilter = document.getElementById('activityModuleFilter');
    const activityActionFilter = document.getElementById('activityActionFilter');
    const activityLogSearch = document.getElementById('activityLogSearch');

    async function loadActivityLogs() {
        if (!activityLogsContainer) return;
        
        // Check permission first
        if (!hasPermission('users', 'viewActivity')) {
            activityLogsContainer.innerHTML = '<div class="logs-empty permission-denied"><div class="empty-icon">🔒</div><h3>Permission Denied</h3><p>You do not have permission to view activity log.<br>Contact your administrator for access.</p></div>';
            return;
        }
        
        activityLogsContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading activity...</p></div>';
        
        try {
            const result = await getActivityLogs(200);
            if (!result.success) {
                activityLogsContainer.innerHTML = `<div class="logs-empty permission-denied"><div class="empty-icon">🔒</div><h3>Access Denied</h3><p>${result.error}</p></div>`;
                return;
            }
            activityLogs = result.data;
            renderActivityLogs();
        } catch (error) {
            console.error("Error loading activity logs:", error);
            activityLogsContainer.innerHTML = '<div class="logs-empty"><div class="empty-icon">❌</div><p>Failed to load activity logs</p></div>';
        }
    }

    function renderActivityLogs() {
        if (!activityLogsContainer) return;
        
        let filteredLogs = [...activityLogs];
        
        // Apply module filter
        const moduleFilter = activityModuleFilter?.value || 'all';
        if (moduleFilter !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.module === moduleFilter);
        }
        
        // Apply action filter
        const actionFilter = activityActionFilter?.value || 'all';
        if (actionFilter !== 'all') {
            filteredLogs = filteredLogs.filter(log => log.action === actionFilter);
        }
        
        // Apply search
        const search = activityLogSearch?.value?.toLowerCase() || '';
        if (search) {
            filteredLogs = filteredLogs.filter(log => 
                log.username?.toLowerCase().includes(search) ||
                log.description?.toLowerCase().includes(search)
            );
        }
        
        if (filteredLogs.length === 0) {
            activityLogsContainer.innerHTML = '<div class="logs-empty"><div class="empty-icon">📋</div><p>No activity logs found</p></div>';
            return;
        }
        
        const moduleIcons = {
            teams: '👥',
            pools: '🏊',
            matches: '⚔️',
            users: '👤',
            session: '🔐'
        };
        
        activityLogsContainer.innerHTML = `
            <table class="log-table">
                <thead>
                    <tr>
                        <th>Time</th>
                        <th>User</th>
                        <th>Module</th>
                        <th>Action</th>
                        <th>Description</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredLogs.map(log => `
                        <tr>
                            <td class="log-timestamp">${formatLogTime(log.timestamp)}</td>
                            <td class="log-user">@${log.username || 'unknown'}</td>
                            <td>
                                <span class="log-module">
                                    ${moduleIcons[log.module] || '📦'} ${log.module || 'unknown'}
                                </span>
                            </td>
                            <td>
                                <span class="log-action ${log.action}">
                                    ${log.action || 'unknown'}
                                </span>
                            </td>
                            <td class="log-description" title="${log.description || ''}">${log.description || '-'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    }

    // Activity log filter/search listeners
    activityModuleFilter?.addEventListener('change', renderActivityLogs);
    activityActionFilter?.addEventListener('change', renderActivityLogs);
    activityLogSearch?.addEventListener('input', debounce(renderActivityLogs, 300));
    document.getElementById('refreshActivityLogs')?.addEventListener('click', loadActivityLogs);

    // ==================== HELPER FUNCTIONS FOR LOGS ====================
    function formatLogTime(timestamp) {
        if (!timestamp) return '-';
        const date = new Date(timestamp);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    }

    function debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }

    // ==================== INITIAL LOAD ====================
    // Restore saved filter from localStorage
    const savedFilter = getFromStorage('selectedFilter', 'male');
    filterEl.value = savedFilter;
    
    gridEl.innerHTML = '<div class="loading-state"><div class="spinner"></div><p>Loading...</p></div>';
    teams = await getTeams();
    applyFilter();
    await loadPools();
    await loadMatches();
    
    // Load users if admin
    if (isAdmin()) {
        await loadUsers();
    }
    
    // Always start on teams tab (tab persistence removed)
    // Filter (male/female) persistence is still active
})();
