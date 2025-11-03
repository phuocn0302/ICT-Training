document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const testContainer = document.getElementById('test-container');
    const messageContainer = document.getElementById('message-container');
    const messageText = document.getElementById('message-text');
    const questionList = document.getElementById('question-list');
    const sidebar = document.getElementById('sidebar');
    const toggleSidebarBtn = document.getElementById('toggle-sidebar-btn');
    const closeSidebarBtn = document.getElementById('close-sidebar-btn');
    const questionBankSelect = document.getElementById('question-bank-select');
    const testStats = document.getElementById('test-stats');
    const testStatsMobile = document.getElementById('test-stats-mobile');

    // New Right Sidebar
    const questionGrid = document.getElementById('question-grid');

    const qTitle = document.getElementById('question-title');
    const qCounter = document.getElementById('question-counter');
    const qText = document.getElementById('question-text');
    const choicesContainer = document.getElementById('choices-container');
    
    const answerContainer = document.getElementById('answer-container');
    const feedbackText = document.getElementById('feedback-text');
    const feedbackDetail = document.getElementById('feedback-detail');
    const explanation = document.getElementById('explanation-text');

    const prevBtn = document.getElementById('prev-btn');
    const nextBtn = document.getElementById('next-btn');
    const submitTestBtn = document.getElementById('submit-test-btn');

    // --- State ---
    let allQuestions = [];
    let currentQuestionIndex = 0;
    let userAnswers = []; // Will store 'A', ['A', 'C'], or null
    let testSubmitted = false;
    
    /**
     * Helper function to shuffle an array in place
     * @param {array} array 
     */
    function shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
    }

    /**
     * Fetches the list of available test banks and populates the dropdown.
     */
    async function loadTestBankManifest() {
        try {
            const response = await fetch('data/manifest.json');
            if (!response.ok) {
                throw new Error('Could not load data/manifest.json');
            }
            const testBanks = await response.json();

            if (!testBanks || testBanks.length === 0) {
                throw new Error('manifest.json is empty or invalid.');
            }

            // Clear loading option
            questionBankSelect.innerHTML = '';

            // Populate dropdown
            testBanks.forEach(bank => {
                const option = document.createElement('option');
                option.value = bank.fileName; // e.g., "question_bank_pre_2324.json"
                option.textContent = bank.test_name; // e.g., "Question Bank 1"
                questionBankSelect.appendChild(option);
            });

            // Add event listener *after* populating
            questionBankSelect.addEventListener('change', (e) => {
                loadQuestions(`data/${e.target.value}`);
            });

            // Load the first test bank by default
            if (testBanks.length > 0) {
                loadQuestions(`data/${testBanks[0].fileName}`);
            }

        } catch (error) {
            console.error("Error loading test bank manifest:", error);
            messageText.textContent = `Error: ${error.message}. Please create 'data/manifest.json'.`;
            messageText.classList.add('text-red-500');
            questionBankSelect.innerHTML = '<option value="">Error loading tests</option>';
        }
    }


    /**
     * Fetches and loads the test questions from the JSON file.
     */
    async function loadQuestions(jsonFileName) {
        // Reset state for new bank
        allQuestions = [];
        currentQuestionIndex = 0;
        userAnswers = [];
        testSubmitted = false;
        testContainer.classList.add('hidden');
        messageContainer.classList.remove('hidden');
        messageText.textContent = 'Loading questions...';
        messageText.classList.remove('text-red-500');

        // Reset submit button to "Submit Test" state
        submitTestBtn.disabled = false;
        submitTestBtn.textContent = "Submit Test";
        submitTestBtn.classList.remove('bg-gray-400', 'hover:bg-gray-400', 'cursor-not-allowed'); // Remove disabled
        submitTestBtn.classList.remove('bg-blue-600', 'hover:bg-blue-700'); // Remove retry
        submitTestBtn.classList.add('bg-indigo-600', 'hover:bg-indigo-700'); // Add submit

        prevBtn.classList.add('hidden'); // Hide until loaded
        nextBtn.classList.add('hidden'); // Hide until loaded
        
        // Hide stats on load
        testStats.textContent = '';
        testStats.classList.add('hidden');
        testStatsMobile.textContent = '';
        testStatsMobile.classList.add('hidden');
        
        updateTestStats(); // Run to clear grid
        questionList.innerHTML = ''; // Clear left sidebar
        questionGrid.innerHTML = ''; // Clear right sidebar

        try {
            const response = await fetch(jsonFileName);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status} - Could not find ${jsonFileName}.`);
            }
            let fetchedQuestions = await response.json();
            
            if (!fetchedQuestions || fetchedQuestions.length === 0) {
                throw new Error("JSON file is empty or not in the correct format.");
            }

            // Shuffle choices *once* per question and store it
            fetchedQuestions.forEach(q => {
                // Create a new property 'shuffledChoices'
                // Keep original 'choices' intact in case we need it
                q.shuffledChoices = [...q.choices].sort(() => Math.random() - 0.5);
            });

            // --- Group, Shuffle, and Re-assemble Questions ---
            const groups = {
                single: [],
                multiple: [],
                true_false: []
            };
            
            // 1. Group questions by type
            fetchedQuestions.forEach(q => {
                const type = q.questionType || 'single';
                if (type === 'single') groups.single.push(q);
                else if (type === 'multiple') groups.multiple.push(q);
                else if (type === 'true_false') groups.true_false.push(q);
            });

            // 2. Shuffle questions within each group
            shuffleArray(groups.single);
            shuffleArray(groups.multiple);
            shuffleArray(groups.true_false);

            // 3. Re-assemble the allQuestions array in order
            allQuestions = [
                ...groups.single,
                ...groups.multiple,
                ...groups.true_false
            ];
            // --- End of Grouping/Shuffling ---


            // Initialize user answers array
            userAnswers = new Array(allQuestions.length).fill(null);

            // Success! Show the test.
            messageContainer.classList.add('hidden');
            testContainer.classList.remove('hidden');
            
            populateQuestionListSidebar(); // Populate left sidebar
            populateQuestionGridSidebar(); // Populate right sidebar
            displayQuestion(currentQuestionIndex);
            updateTestStats(); // Set initial grid stats

        } catch (error)
        {
            console.error("Error loading questions:", error);
            messageText.textContent = `Error: ${error.message}`;
            messageText.classList.add('text-red-500');
        }
    }

    /**
     * Populates the LEFT sidebar with question links.
     */
    function populateQuestionListSidebar() {
        questionList.innerHTML = ''; // Clear existing list
        let currentType = null;

        allQuestions.forEach((question, index) => {
            const questionType = question.questionType || 'single';

            // Add separator if type changes
            if (questionType !== currentType) {
                currentType = questionType;
                
                const separatorLi = document.createElement('li');
                separatorLi.className = "pt-3"; // Add padding top

                // Add a border *unless* it's the very first item
                if (index !== 0) {
                    const borderDiv = document.createElement('div');
                    borderDiv.className = "border-t border-gray-200 mb-2";
                    separatorLi.appendChild(borderDiv);
                }

                const titleSpan = document.createElement('span');
                titleSpan.className = "block text-xs font-semibold text-gray-500 uppercase";
                
                if (currentType === 'single') titleSpan.textContent = "Single Choice";
                else if (currentType === 'multiple') titleSpan.textContent = "Multiple Choice";
                else if (currentType === 'true_false') titleSpan.textContent = "True / False";
                else titleSpan.textContent = "Other";

                separatorLi.appendChild(titleSpan);
                questionList.appendChild(separatorLi);
            }
            
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.dataset.index = index;
            button.id = `q-link-${index}`;
            
            // Create text span
            const textSpan = document.createElement('span');
            textSpan.textContent = `Question ${index + 1}`;
            textSpan.className = "flex-1 truncate";

            // Create icon span
            const iconSpan = document.createElement('span');
            iconSpan.id = `q-icon-${index}`;
            iconSpan.className = "ml-2";
            // iconSpan will be populated on submit

            button.className = "w-full text-left py-2 px-3 rounded-lg text-gray-700 hover:bg-indigo-100 hover:text-indigo-700 transition duration-150 flex justify-between items-center";
            
            button.appendChild(textSpan);
            button.appendChild(iconSpan);

            button.addEventListener('click', () => {
                displayQuestion(index);
                // Hide sidebar on mobile after selection
                if (window.innerWidth < 768) {
                    sidebar.classList.add('-translate-x-full');
                }
            });

            li.appendChild(button);
            questionList.appendChild(li);
        });
    }

    /**
     * Populates the RIGHT sidebar with question grid buttons.
     */
    function populateQuestionGridSidebar() {
        questionGrid.innerHTML = ''; // Clear existing grid
        
        allQuestions.forEach((question, index) => {
            const button = document.createElement('button');
            button.dataset.index = index;
            button.id = `q-grid-btn-${index}`;
            button.className = "w-10 h-10 border rounded-lg flex items-center justify-center font-medium text-gray-700 hover:bg-gray-100 transition-all";
            
            // Text number
            const textSpan = document.createElement('span');
            textSpan.textContent = index + 1;
            
            // Icon for "answered" (now unused, but span is still a good spacer)
            const iconSpan = document.createElement('span');
            iconSpan.id = `q-grid-icon-${index}`;
            iconSpan.className = "ml-1"; // Add a little space

            button.appendChild(textSpan);
            button.appendChild(iconSpan);

            button.addEventListener('click', () => {
                displayQuestion(index);
            });

            questionGrid.appendChild(button);
        });
    }


    /**
     * Displays a question and its choices based on the given index.
     */
    function displayQuestion(index) {
        currentQuestionIndex = index;
        const question = allQuestions[index];
        const questionType = question.questionType || 'single'; // Default to single
        const correctAnswer = question.answer.trim();
        const selectedAnswer = userAnswers[index];

        // 1. Set question title, text, and counter
        qTitle.textContent = `Question ${index + 1}`;
        qText.textContent = question.question;
        qCounter.textContent = `Total Questions: ${allQuestions.length}`;

        // 2. Clear old choices
        choicesContainer.innerHTML = '';

        // 3. Use the pre-shuffled list of choices
        const shuffledChoices = question.shuffledChoices;

        // 4. Create and append new choices (radio or checkbox)
        const inputType = questionType === 'multiple' ? 'checkbox' : 'radio';
        
        shuffledChoices.forEach((choice, i) => {
            // Extract letter/text for choice
            // Handles "A. Text", "A Text", or "True", "False"
            const parts = choice.match(/^([A-Z])\.?\s(.*)$/s); // For A. Text
            let choiceLetter, choiceText;

            if (parts) {
                choiceLetter = parts[1]; // "A"
                choiceText = parts[2]; // "A. cat" -> "cat"
            } else if (choice.toUpperCase() === "TRUE" || choice.toUpperCase() === "FALSE") {
                choiceLetter = choice; // "True"
                choiceText = choice;
            } else {
                // Fallback for unexpected formats
                choiceLetter = `Choice ${i+1}`;
                choiceText = choice;
            }


            const choiceId = `choice-${i}`;
            const choiceElement = document.createElement('div');
            choiceElement.classList.add('flex', 'items-center', 'p-3', 'border', 'rounded-lg', 'transition-all');
            
            const input = document.createElement('input');
            input.type = inputType;
            input.id = choiceId;
            input.name = 'choice'; // Radio buttons need same name
            if (inputType === 'checkbox') {
                 input.name = `choice-${i}`; // Checkboxes can have unique names or be grouped
            }
            input.value = choiceLetter; // Store just the letter (e.g., "A" or "TRUE")
            input.classList.add('w-4', 'h-4', 'text-indigo-600', 'focus:ring-indigo-500');
            
            // Check if this choice should be pre-selected
            if (questionType === 'multiple') {
                if (Array.isArray(selectedAnswer) && selectedAnswer.includes(choiceLetter)) {
                    input.checked = true;
                }
            } else {
                if (selectedAnswer === choiceLetter) {
                    input.checked = true;
                }
            }

            // Handle test submitted state
            if (testSubmitted) {
                input.disabled = true;
                // Style correct answer
                if (correctAnswer.includes(choiceLetter)) {
                    choiceElement.classList.add('choice-correct');
                }
                // Style user's incorrect answer
                const userMadeThisSelection = (questionType === 'multiple')
                    ? Array.isArray(selectedAnswer) && selectedAnswer.includes(choiceLetter)
                    : selectedAnswer === choiceLetter;

                if (userMadeThisSelection && !correctAnswer.includes(choiceLetter)) {
                    choiceElement.classList.add('choice-incorrect');
                }
            } else {
                // Add listeners only if test is not submitted
                choiceElement.classList.add('hover:bg-gray-50', 'cursor-pointer');
                
                input.addEventListener('change', () => {
                    if (questionType === 'multiple') {
                        // Get all checked boxes and store their values as an array
                        const checkedBoxes = choicesContainer.querySelectorAll('input[type="checkbox"]:checked');
                        const selectedValues = Array.from(checkedBoxes).map(cb => cb.value);
                        userAnswers[currentQuestionIndex] = selectedValues.length > 0 ? selectedValues : null;
                    } else {
                        // Store the single radio value
                        userAnswers[currentQuestionIndex] = input.value;
                    }
                    updateTestStats(); // Update stats on answer change
                });
                
                // Add listener to label area to check input
                choiceElement.addEventListener('click', (e) => {
                    // Only run this logic if the click is on the DIV itself (the background),
                    // not on the input or the label (which have their own native behavior).
                    if (e.target === choiceElement && !testSubmitted) {
                        input.checked = (inputType === 'checkbox') ? !input.checked : true;
                        // Manually trigger change event to save answer
                        input.dispatchEvent(new Event('change'));
                    }
                });
            }
            
            const label = document.createElement('label');
            label.htmlFor = choiceId;
            label.textContent = choiceText; // Show the full choice text
            label.classList.add('ml-3', 'block', 'text-base', 'font-medium', 'text-gray-700', 'w-full');
            if (!testSubmitted) label.classList.add('cursor-pointer');
            
            choiceElement.appendChild(input);
            choiceElement.appendChild(label);
            choicesContainer.appendChild(choiceElement);
        });

        // 4. Update active state in LEFT sidebar
        document.querySelectorAll('#question-list button').forEach(btn => {
            btn.classList.remove('bg-indigo-100', 'text-indigo-700', 'font-bold');
        });
        document.getElementById(`q-link-${index}`).classList.add('bg-indigo-100', 'text-indigo-700', 'font-bold');
        
        // 5. Update active state in RIGHT sidebar
        document.querySelectorAll('#question-grid button').forEach(btn => {
            // Remove just the ring indicator from ALL buttons
            btn.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2');
        });
        
        const activeGridBtn = document.getElementById(`q-grid-btn-${index}`);
        
        // ALWAYS show the ring on the active button, before or after submit
        activeGridBtn.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2');

        // 6. Handle submitted state
        if (testSubmitted) {
            answerContainer.classList.remove('hidden');
            explanation.textContent = question.explanation || 'No explanation provided.';

            const { isCorrect, selectedString, correctString } = checkAnswer(question, selectedAnswer);

            if (isCorrect) {
                feedbackText.textContent = "Correct!";
                answerContainer.className = "border-l-4 p-4 rounded-md mt-6 feedback-correct";
                feedbackDetail.textContent = `You selected: ${selectedString}`;
            } else if (selectedAnswer === null || (Array.isArray(selectedAnswer) && selectedAnswer.length === 0)) {
                feedbackText.textContent = "Unanswered";
                answerContainer.className = "border-l-4 p-4 rounded-md mt-6 feedback-unanswered";
                feedbackDetail.textContent = `Correct Answer: ${correctString}`;
            } else {
                feedbackText.textContent = "Incorrect";
                answerContainer.className = "border-l-4 p-4 rounded-md mt-6 feedback-incorrect";
                feedbackDetail.textContent = `You selected: ${selectedString} | Correct Answer: ${correctString}`;
            }

        } else {
            // Hide answer
            answerContainer.classList.add('hidden');
        }
        
        // 7. Show/Hide and Enable/Disable Nav Buttons
        // This now runs regardless of submission state
        prevBtn.classList.remove('hidden');
        nextBtn.classList.remove('hidden');
        // Update navigation button states
        prevBtn.disabled = index === 0;
        nextBtn.disabled = index === allQuestions.length - 1;
    }

    /**
     * Helper function to check an answer
     * @param {object} question - The question object
     * @param {string|string[]} selectedAnswer - The user's answer
     * @returns {object} { isCorrect, selectedString, correctString }
     */
    function checkAnswer(question, selectedAnswer) {
        const correctAnswer = question.answer.trim();
        const questionType = question.questionType || 'single';
        let isCorrect = false;
        let selectedString = 'None';
        let correctString = correctAnswer;

        if (questionType === 'multiple') {
            const sortedUser = (Array.isArray(selectedAnswer) ? selectedAnswer : []).sort().join('');
            const sortedCorrect = correctAnswer.split('').sort().join('');
            isCorrect = sortedUser === sortedCorrect;
            selectedString = (Array.isArray(selectedAnswer) ? selectedAnswer : []).sort().join(', ') || 'None';
            correctString = correctAnswer.split('').sort().join(', ');
        } else {
            isCorrect = selectedAnswer === correctAnswer;
            selectedString = selectedAnswer || 'None';
        }
        
        return { isCorrect, selectedString, correctString };
    }

    /**
     * Updates the right grid icons based on "answered" status.
     * Hides the score/stats text before submission.
     */
    function updateTestStats() {
        if (!allQuestions || allQuestions.length === 0) {
            testStats.textContent = '';
            testStats.classList.add('hidden');
            testStatsMobile.textContent = '';
            testStatsMobile.classList.add('hidden');
            return;
        }

        // Before submission, hide stats. They are only shown on submit.
        if (!testSubmitted) {
            testStats.textContent = '';
            testStats.classList.add('hidden');
            testStatsMobile.textContent = '';
            testStatsMobile.classList.add('hidden');
        }
        
        userAnswers.forEach((answer, index) => {
            const isAnswered = (answer !== null && answer !== undefined) && 
                               (!Array.isArray(answer) || answer.length > 0);

            // Update grid button style (only if not submitted)
            if (!testSubmitted) {
                const iconSpan = document.getElementById(`q-grid-icon-${index}`);
                iconSpan.innerHTML = ''; // Clear icon

                const gridButton = document.getElementById(`q-grid-btn-${index}`);
                if (isAnswered) {
                    gridButton.classList.add('bg-indigo-600', 'text-white', 'font-bold');
                    gridButton.classList.remove('hover:bg-gray-100', 'text-gray-700');
                } else {
                    gridButton.classList.add('hover:bg-gray-100', 'text-gray-700');
                    gridButton.classList.remove('bg-indigo-600', 'text-white', 'font-bold');
                }
            }
        });
    }


    /**
     * Submits the entire test, grades it, and shows results.
     */
    function submitTest() {
        testSubmitted = true;
        let correctCount = 0;
        
        // Change submit button to "Retry Test"
        submitTestBtn.disabled = false; 
        submitTestBtn.textContent = "Retry Test";
        submitTestBtn.classList.remove('bg-gray-400', 'hover:bg-gray-400', 'cursor-not-allowed');
        submitTestBtn.classList.remove('bg-indigo-600', 'hover:bg-indigo-700'); // Remove submit styles
        submitTestBtn.classList.add('bg-blue-600', 'hover:bg-blue-700'); // Add retry styles
        
        // Prev/Next buttons are no longer hidden here

        // Update sidebars with results
        allQuestions.forEach((question, index) => {
            const userAnswer = userAnswers[index];
            const { isCorrect } = checkAnswer(question, userAnswer);
            const isUnanswered = userAnswer === null || (Array.isArray(userAnswer) && userAnswer.length === 0);

            if (isCorrect) correctCount++;

            // Update LEFT sidebar (list)
            const listIconSpan = document.getElementById(`q-icon-${index}`);
            const listButton = document.getElementById(`q-link-${index}`);
            
            // Update RIGHT sidebar (grid)
            const gridButton = document.getElementById(`q-grid-btn-${index}`);
            const gridIconSpan = document.getElementById(`q-grid-icon-${index}`);
            gridIconSpan.innerHTML = ''; // Clear "OK" icon

            // Clear any hover/base/answered styles
            gridButton.classList.remove('text-gray-700', 'hover:bg-gray-100', 'bg-indigo-600', 'text-white', 'font-bold');

            if (isUnanswered) {
                // Left List
                listIconSpan.innerHTML = `<svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>`;
                listButton.classList.add('text-gray-500');
                // Right Grid
                gridButton.classList.add('bg-gray-300', 'text-gray-600');
            } else if (isCorrect) {
                // Left List
                listIconSpan.innerHTML = `<svg class="w-5 h-5 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"></path></svg>`;
                listButton.classList.add('text-green-700');
                // Right Grid
                gridButton.classList.add('bg-green-500', 'text-white', 'font-bold');
            } else {
                // Left List
                listIconSpan.innerHTML = `<svg classs="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"></path></svg>`;
                listButton.classList.add('text-red-700');
                // Right Grid
                gridButton.classList.add('bg-red-500', 'text-white', 'font-bold');
            }
        });

        // Calculate and display final score
        const maxScore = allQuestions.length * 10;
        const userScore = correctCount * 10;
        
        testStats.textContent = `Score: ${userScore} / ${maxScore}`;
        testStatsMobile.textContent = `Score: ${userScore} / ${maxScore}`;
        
        // Make stats visible
        testStats.classList.remove('hidden');
        testStatsMobile.classList.remove('hidden');

        // Re-display the current question to show its result
        displayQuestion(currentQuestionIndex);
    }


    // --- Event Listeners ---
    prevBtn.addEventListener('click', () => {
        if (currentQuestionIndex > 0) {
            displayQuestion(currentQuestionIndex - 1);
        }
    });

    nextBtn.addEventListener('click', () => {
        if (currentQuestionIndex < allQuestions.length - 1) {
            displayQuestion(currentQuestionIndex + 1);
        }
    });

    submitTestBtn.addEventListener('click', () => {
        if (testSubmitted) {
            // "Retry Test" button was clicked
            if (window.confirm("Are you sure you want to retry the test? All your progress will be lost.")) {
                loadQuestions(`data/${questionBankSelect.value}`);
            }
        } else {
            // "Submit Test" button was clicked
            if (window.confirm("Are you sure you want to submit? You cannot change your answers after this.")) {
                submitTest();
            }
        }
    });

    // Mobile sidebar toggles
    toggleSidebarBtn.addEventListener('click', () => {
        sidebar.classList.remove('-translate-x-full');
    });
    closeSidebarBtn.addEventListener('click', () => {
        sidebar.classList.add('-translate-x-full');
    });

    // --- Initial Load ---
    // Load the manifest, which will then load the first test
    loadTestBankManifest();
});

