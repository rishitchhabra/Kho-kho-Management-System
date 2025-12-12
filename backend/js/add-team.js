// Add team page functionality
(function() {
    const statusEl = document.getElementById("formStatus");
    const form = document.getElementById("teamForm");

    /**
     * Show status message
     * @param {string} message - Message to display
     * @param {string} type - 'success' or 'error'
     */
    function showStatus(message, type) {
        statusEl.textContent = message;
        statusEl.className = `status ${type}`;
    }

    /**
     * Clear status message
     */
    function clearStatus() {
        statusEl.textContent = "";
        statusEl.className = "status";
    }

    /**
     * Extract player data from form
     * @param {FormData} formData 
     * @returns {Array} Array of 12 player objects
     */
    function extractPlayerData(formData) {
        const players = [];
        for (let i = 1; i <= 12; i++) {
            players.push({
                name: formData.get(`player${i}_name`)?.trim() || '',
                father_name: formData.get(`player${i}_father`)?.trim() || '',
                aadhaar: formData.get(`player${i}_aadhaar`)?.trim() || '',
                class: formData.get(`player${i}_class`) || '',
                dob: formData.get(`player${i}_dob`) || '',
                pen: formData.get(`player${i}_pen`)?.trim() || '',
                udise_status: formData.get(`player${i}_udise`) || ''
            });
        }
        return players;
    }

    /**
     * Validate player data
     * @param {Array} players 
     * @returns {Object} { valid: boolean, message: string }
     */
    function validatePlayers(players) {
        for (let i = 0; i < players.length; i++) {
            const p = players[i];
            const playerNum = i + 1;
            
            if (!p.name) {
                return { valid: false, message: `Player ${playerNum}: Name is required.` };
            }
            if (!p.father_name) {
                return { valid: false, message: `Player ${playerNum}: Father's name is required.` };
            }
            if (!p.aadhaar || p.aadhaar.length !== 12 || !/^\d{12}$/.test(p.aadhaar)) {
                return { valid: false, message: `Player ${playerNum}: Valid 12-digit Aadhaar number is required.` };
            }
            if (!p.class) {
                return { valid: false, message: `Player ${playerNum}: Class is required.` };
            }
            if (!p.dob) {
                return { valid: false, message: `Player ${playerNum}: Date of birth is required.` };
            }
        }
        return { valid: true, message: '' };
    }

    // Form submission handler
    form.addEventListener("submit", async (event) => {
        event.preventDefault();
        clearStatus();

        const formData = new FormData(form);
        
        // Extract school and coach info
        const schoolName = formData.get("schoolName")?.trim();
        const teamType = formData.get("teamType");
        const coachName = formData.get("coachName")?.trim();
        const coachNumber = formData.get("coachNumber")?.trim();

        // Validate school and coach info
        if (!schoolName || !teamType || !coachName || !coachNumber) {
            showStatus("Please fill in all school and coach information.", "error");
            return;
        }

        // Extract and validate player data
        const players = extractPlayerData(formData);
        const validation = validatePlayers(players);
        
        if (!validation.valid) {
            showStatus(validation.message, "error");
            return;
        }

        // Prepare team object
        const team = {
            school_name: schoolName,
            team_type: teamType,
            coach_name: coachName,
            coach_number: coachNumber,
            player_count: 12,
            players: players
        };

        // Show saving state
        showStatus("Saving team...", "success");

        // Use shared addTeam function (now async with Supabase)
        const result = await addTeam(team);

        if (result.success) {
            form.reset();
            // Regenerate player fields after reset
            if (typeof generatePlayerFields === 'function') {
                generatePlayerFields();
            }
            form.querySelector("input[name='schoolName']").focus();
            showStatus("Team saved successfully! You can add another team.", "success");
        } else {
            showStatus("Failed to save team. Please try again.", "error");
        }
    });
})();
