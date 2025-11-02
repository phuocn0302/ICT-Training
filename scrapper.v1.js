(async function () {

    // --- Configuration ---
    // Selector for the links to click (e.g., "Question 1", "Question 2")
    const QUESTION_LINK_SELECTOR = 'ul[data-v-4104eeff] li a[data-v-4104eeff]';

    // Selector for the main question text
    const QUESTION_TEXT_SELECTOR = 'div[data-v-9e085db0].content';

    // Selector for the container holding all the choices
    const CHOICES_CONTAINER_SELECTOR = 'div[data-v-1ddde3fd].option-list-item';
    
    // Selector for an individual choice's text (relative to the container)
    // We combine the order (A.) and the content.
    const CHOICE_TEXT_SELECTOR = 'div[data-v-1ddde3fd].option-content';

    // Selector for the correct answer text
    const ANSWER_SELECTOR = 'div.status-info > span[data-v-97b5e620]:not([class])';

    // Selector for the explanation text
    const EXPLANATION_SELECTOR = 'div[data-v-97b5e620].parse-wrapper .content';

    // Delay in milliseconds to wait for content to load after clicking
    const CLICK_DELAY_MS = 1;
    // --- End Configuration ---


    /**
     * A helper function to pause execution.
     * @param {number} ms - Milliseconds to wait.
     */
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    /**
     * Finds and extracts the text for a single element.
     * @param {string} selector - The CSS selector for the element.
     * @returns {string} The trimmed text content, or an empty string if not found.
     */
    const getText = (selector) => {
        const element = document.querySelector(selector);
        return element ? element.textContent.trim() : '';
    };

    /**
     * Finds and extracts text from multiple elements.
     * @param {string} selector - The CSS selector for the elements.
     * @returns {string[]} An array of trimmed text content.
     */
    const getAllText = (selector) => {
        const elements = document.querySelectorAll(selector);
        return Array.from(elements).map(el => {
            // Special handling for choice text to combine order (e.g., "A.") and text
            if (selector === CHOICE_TEXT_SELECTOR) {
                const order = el.querySelector('.option-order-str')?.textContent.trim() || '';
                const content = el.querySelector('.markdown-viewer-program .content')?.textContent.trim() || '';
                return `${order} ${content}`.trim();
            }
            return el.textContent.trim();
        });
    };

    /**
     * Determines the question type based on the answer string.
     * @param {string} answerText - The correct answer text (e.g., "A", "AC", "True").
     * @returns {string} "single", "multiple", or "true_false".
     */
    const getQuestionType = (answerText) => {
        const text = answerText.toUpperCase();
        
        if (text === "TRUE" || text === "FALSE") {
            return "true_false";
        }
        
        // Check if it's only letters (A-Z)
        if (/^[A-Z]+$/.test(text)) {
            if (text.length === 1) {
                return "single";
            } else {
                return "multiple";
            }
        }
        
        // Default fallback
        return "single";
    };

    /**
     * Scrapes the currently visible question data from the page.
     * @returns {object|null} An object with question data, or null if essential data is missing.
     */
    const scrapeCurrentQuestion = () => {
        const questionText = getText(QUESTION_TEXT_SELECTOR);
        if (!questionText) {
            console.warn("Could not find question text. Skipping.");
            return null;
        }

        const choices = getAllText(CHOICE_TEXT_SELECTOR).filter(c => c); // Clean empty
        
        // Answer text needs special parsing (e.g., "Answer：C" -> "C")
        let answerText = getText(ANSWER_SELECTOR);
        if (answerText.includes('：')) {
            answerText = answerText.split('：')[1].trim();
        }

        const explanation = getText(EXPLANATION_SELECTOR);
        const questionType = getQuestionType(answerText);

        return {
            question: questionText,
            choices: choices,
            answer: answerText,
            explanation: explanation,
            questionType: questionType
        };
    };

    // --- Main Execution ---
    console.log("Starting quiz scraper...");
    const allQuestionData = [];
    const questionLinks = document.querySelectorAll(QUESTION_LINK_SELECTOR);

    if (questionLinks.length === 0) {
        console.error(`No question links found with selector: ${QUESTION_LINK_SELECTOR}`);
        return;
    }

    console.log(`Found ${questionLinks.length} questions.`);

    for (let i = 0; i < questionLinks.length; i++) {
        const link = questionLinks[i];
        const questionTitle = link.textContent.trim() || `Question ${i + 1}`;
        
        console.log(`Scraping: ${questionTitle}`);

        // Click the link to load the question
        link.click();
        
        // Wait for content to load
        await sleep(CLICK_DELAY_MS);

        // Scrape the data
        const data = scrapeCurrentQuestion();
        
        if (data) {
            // Add the question title to the scraped data
            allQuestionData.push({ title: questionTitle, ...data });
        } else {
            console.error(`Failed to scrape data for ${questionTitle}.`);
        }
    }

    console.log("Scraping complete!");
    console.log("Total questions scraped:", allQuestionData.length);
    
    // Log the final JSON data as a string
    console.log("\n\n--- JSON Output ---");
    console.log(JSON.stringify(allQuestionData, null, 2));
    
    // Log the array as an object to the console for easy inspection
    console.log("\n\n--- Inspectable Array ---");
    console.log(allQuestionData);

})();