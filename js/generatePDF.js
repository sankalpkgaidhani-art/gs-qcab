document.getElementById("generateQCAB").addEventListener("click", async () => {

    // ==========================================
    // CHECK LOGIN BEFORE ANY PDF GENERATION
    // ==========================================

    if (!window.supabaseClient) {
        alert("Supabase client not loaded.");
        return;
    }

    const {
        data: { session },
        error
    } = await window.supabaseClient.auth.getSession();

    if (error) {
        console.error("Session check error:", error);
        alert("Unable to check login status.");
        return;
    }

    if (!session) {
        alert("Please login first.");
        return;
    }

    // ==========================================
    // CUSTOM QUESTIONS
    // ==========================================

    if (
        typeof window.isCustomQuestionMode === "function" &&
        window.isCustomQuestionMode()
    ) {
        if (typeof window.getCustomQuestions !== "function") {
            alert("Custom question handler not loaded!");
            return;
        }

        const customQuestions = window.getCustomQuestions();

        if (customQuestions.length === 0) {
            alert("Add at least one custom question first!");
            return;
        }

        customQuestions.forEach((q, i) => {
            q.question_number = i + 1;
        });

        await generateQCABPDF(customQuestions);
        return;
    }

    // ==========================================
    // PYQ QUESTIONS
    // ==========================================

    if (typeof window.getSelectedQuestions !== "function") {
        alert("Selection logic not loaded!");
        return;
    }

    const selectedQuestions = window.getSelectedQuestions();

    if (selectedQuestions.length === 0) {
        alert("Select questions first!");
        return;
    }

    // ==========================================
    // CHECK FREE / PAID / ADMIN ACCESS
    // ==========================================

    let accessLevel = "free";

    try {

        const response = await fetch(
            "https://govhlwqbobforvprdlps.supabase.co/functions/v1/get-questions",
            {
                method: "POST",

                headers: {
                    "Content-Type": "application/json",

                    "apikey":
                        "sb_publishable_lr04EFZActHWsuFS9S24QQ_ryPJMYFM",

                    "Authorization":
                        "Bearer " + session.access_token
                },

                body: JSON.stringify({
                    paper: "Paper I",
                    year: 2026
                })
            }
        );

        const result = await response.json();

        if (result.access_level) {
            accessLevel = result.access_level;
        }

    } catch (error) {

        console.error(
            "Unable to check access level:",
            error
        );

        alert(
            "Unable to verify your plan. Please try again."
        );

        return;
    }


    // ==========================================
    // FREE PLAN — ONLY 2026 CAN BE GENERATED
    // ==========================================

    if (accessLevel === "free") {

        const containsNon2026Question =
            selectedQuestions.some(
                q => Number(q.year) !== 2026
            );

        if (containsNon2026Question) {

            alert(
                "Your selection contains questions from years other than 2026, which is not available in the current Free Plan. Please upgrade to Premium to generate a QCAB containing these questions."
            );

            return;
        }
    }


    // ==========================================
    // KEEP CURRENT MARKS-BASED ORDERING
    // ==========================================

    selectedQuestions.sort(
        (a, b) => a.marks - b.marks
    );

    selectedQuestions.forEach((q, i) => {
        q.question_number = i + 1;
    });

    await generateQCABPDF(selectedQuestions);
});


// ==========================================
// ANSWER PAGE CALCULATION
// ==========================================

function getAnswerPages(q) {

    const marks = Number(q.marks) || 0;

    if (marks === 15) return 3;

    if (marks >= 20) return 4;

    return 2;
}


// ==========================================
// ESCAPE HTML
// ==========================================

function escapePDFHTML(value) {

    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}


// ==========================================
// CHECK RICH QUESTION
// ==========================================

function hasRichQuestion(q) {

    return !!q.question_html &&
        q.question_html.includes("<img");
}


// ==========================================
// WAIT FOR IMAGES
// ==========================================

function waitForImages(container) {

    const images =
        [...container.querySelectorAll("img")];

    return Promise.all(
        images.map(img => {

            if (
                img.complete &&
                img.naturalWidth > 0
            ) {
                return Promise.resolve();
            }

            return new Promise(resolve => {

                img.onload = resolve;

                img.onerror = resolve;

            });

        })
    );
}


// ==========================================
// RENDER QUESTION TO CANVAS
// ==========================================

async function renderQuestionToCanvas(
    q,
    widthPx = 1100
) {

    if (!window.html2canvas) {

        throw new Error(
            "html2canvas is not loaded. Please check your internet connection."
        );
    }

    const host =
        document.createElement("div");

    host.className =
        "pdf-question-render";

    host.style.cssText = [

        "position:fixed",

        "left:-100000px",

        "top:0",

        `width:${widthPx}px`,

        "padding:0",

        "margin:0",

        "background:#fff",

        "color:#111",

        "font-family:Times New Roman, serif",

        "font-size:30px",

        "line-height:1.45",

        "white-space:normal",

        "overflow:visible",

        "z-index:-1"

    ].join(";");

    host.innerHTML =
        q.question_html ||
        escapePDFHTML(
            q.question_text || ""
        );

    host.querySelectorAll("img")
        .forEach(img => {

            img.style.width = "100%";

            img.style.maxWidth = "100%";

            img.style.height = "auto";

            img.style.display = "block";

            img.style.margin = "3px 0";

        });

    document.body.appendChild(host);

    try {

        await waitForImages(host);

        return await window.html2canvas(
            host,
            {
                backgroundColor: "#ffffff",

                scale: 2,

                useCORS: true,

                logging: false
            }
        );

    } finally {

        host.remove();

    }
}


// ==========================================
// ADD CANVAS IMAGE
// ==========================================

function addCanvasImage(
    doc,
    canvas,
    x,
    y,
    maxWidthMm,
    maxHeightMm = Infinity
) {

    let widthMm =
        maxWidthMm;

    let heightMm =
        widthMm *
        canvas.height /
        canvas.width;

    if (heightMm > maxHeightMm) {

        const ratio =
            maxHeightMm /
            heightMm;

        widthMm *= ratio;

        heightMm =
            maxHeightMm;
    }

    const imageData =
        canvas.toDataURL("image/png");

    doc.addImage(
        imageData,
        "PNG",
        x,
        y,
        widthMm,
        heightMm,
        undefined,
        "FAST"
    );

    return {
        width: widthMm,
        height: heightMm
    };
}


// ==========================================
// GENERATE QCAB PDF
// ==========================================

async function generateQCABPDF(questions) {

    const { jsPDF } =
        window.jspdf;

    const doc =
        new jsPDF({
            unit: "mm",
            format: "a4"
        });

    const pageHeight = 297;

    const leftMargin = 25;

    const rightMargin = 185;

    const topMargin = 15;

    const bottomMargin = 282;

    doc.setFont(
        "Times",
        "Roman"
    );

    doc.setFontSize(12);


    // ==========================================
    // PART 1: QUESTION LISTING
    // ==========================================

    let currentY =
        topMargin;

    const localWidth =
        rightMargin -
        leftMargin +
        4;

    const lineHeight = 6;


    for (const q of questions) {

        if (hasRichQuestion(q)) {

            try {

                const canvas =
                    await renderQuestionToCanvas(q);

                const imageHeight =
                    Math.min(
                        42,
                        localWidth *
                        canvas.height /
                        canvas.width
                    );

                const meta =
                    `[${q.marks} M${q.word_limit ? ` / ${q.word_limit} W` : ""}]`;

                const metaLines =
                    doc.splitTextToSize(
                        meta,
                        35
                    );

                const totalHeight =
                    Math.max(
                        imageHeight,
                        metaLines.length *
                        lineHeight
                    ) +
                    lineHeight;


                if (
                    currentY +
                    totalHeight >
                    pageHeight - 15
                ) {

                    doc.addPage();

                    currentY =
                        topMargin;
                }


                addCanvasImage(
                    doc,
                    canvas,
                    leftMargin + 2,
                    currentY,
                    localWidth,
                    42
                );

                doc.text(
                    `${q.question_number}.`,
                    leftMargin - 10,
                    currentY + 5
                );

                doc.setFontSize(9);

                doc.text(
                    metaLines,
                    rightMargin + 2,
                    currentY + 5
                );

                doc.setFontSize(12);

                currentY +=
                    totalHeight + 3;


            } catch (error) {

                console.error(
                    "Rich question rendering failed:",
                    error
                );

                const fallback =
                    `${q.question_text || ""}   [${q.marks} M${q.word_limit ? ` / ${q.word_limit} W` : ""}${q.year ? ` / ${q.year}` : ""}]`;

                const splitText =
                    doc.splitTextToSize(
                        fallback,
                        localWidth
                    );

                const totalHeight =
                    splitText.length *
                    lineHeight +
                    lineHeight;


                if (
                    currentY +
                    totalHeight >
                    pageHeight - 15
                ) {

                    doc.addPage();

                    currentY =
                        topMargin;
                }

                doc.text(
                    `${q.question_number}.`,
                    leftMargin - 10,
                    currentY
                );

                doc.text(
                    splitText,
                    leftMargin + 2,
                    currentY
                );

                currentY +=
                    totalHeight;
            }

        } else {

            const qText =
                `${q.question_text || ""}   [${q.marks} M${q.word_limit ? ` / ${q.word_limit} W` : ""}${q.year ? ` / ${q.year}` : ""}]`;

            const splitText =
                doc.splitTextToSize(
                    qText,
                    localWidth
                );

            const totalHeight =
                splitText.length *
                lineHeight +
                lineHeight;


            if (
                currentY +
                totalHeight >
                pageHeight - 15
            ) {

                doc.addPage();

                currentY =
                    topMargin;
            }

            doc.text(
                `${q.question_number}.`,
                leftMargin - 10,
                currentY
            );

            doc.text(
                splitText,
                leftMargin + 2,
                currentY
            );

            currentY +=
                totalHeight;
        }

    }


    // ==========================================
    // PART 2: QCAB ANSWER PAGES
    // ==========================================

    for (const q of questions) {

        const pagesNeeded =
            getAnswerPages(q);


        for (
            let p = 0;
            p < pagesNeeded;
            p++
        ) {

            doc.addPage();

            doc.setLineWidth(0.3);

            doc.line(
                leftMargin,
                topMargin,
                leftMargin,
                bottomMargin
            );

            doc.line(
                rightMargin,
                topMargin,
                rightMargin,
                bottomMargin
            );


            const footerText =
                `XXXX-${q.question_id || `CUSTOM_${q.question_number}`}`;

            doc.setFontSize(8);

            doc.text(
                footerText,
                leftMargin - 10,
                bottomMargin + 3
            );


            // ==========================================
            // FIRST ANSWER PAGE
            // ==========================================

            if (p === 0) {

                doc.setFontSize(12);

                doc.text(
                    `Q. ${q.question_number}`,
                    leftMargin - 15,
                    topMargin + 5
                );


                const localQuestionWidth =
                    rightMargin -
                    leftMargin -
                    4;

                let questionBottom =
                    topMargin + 5;


                if (hasRichQuestion(q)) {

                    try {

                        const canvas =
                            await renderQuestionToCanvas(q);

                        const image =
                            addCanvasImage(
                                doc,
                                canvas,
                                leftMargin + 2,
                                topMargin,
                                localQuestionWidth,
                                55
                            );

                        questionBottom =
                            topMargin +
                            14 +
                            image.height;


                    } catch (error) {

                        console.error(
                            "Rich question rendering failed:",
                            error
                        );

                        const splitText =
                            doc.splitTextToSize(
                                q.question_text || "",
                                localQuestionWidth
                            );

                        doc.setFontSize(12);

                        doc.text(
                            splitText,
                            leftMargin + 2,
                            topMargin + 5
                        );

                        questionBottom =
                            topMargin +
                            5 +
                            splitText.length * 6;
                    }

                } else {

                    const splitText =
                        doc.splitTextToSize(
                            `${q.question_text || ""}`,
                            localQuestionWidth
                        );

                    doc.setFontSize(12);

                    doc.text(
                        splitText,
                        leftMargin + 2,
                        topMargin + 5
                    );

                    questionBottom =
                        topMargin +
                        5 +
                        splitText.length * 6;
                }


                // ==========================================
                // MARKS / YEAR
                // ==========================================

                doc.setFontSize(12);

                const metadata = [

                    q.marks != null
                        ? `${q.marks} M`
                        : "",

                    q.year
                        ? `${q.year}`
                        : ""

                ]
                    .filter(Boolean)
                    .join(" / ");


                doc.text(
                    metadata,
                    rightMargin + 2,
                    topMargin + 5
                );


                // Answer-writing area
                if (
                    questionBottom <
                    bottomMargin - 4
                ) {

                    doc.setFontSize(8);

                    doc.setTextColor(
                        110,
                        110,
                        110
                    );

                    doc.setTextColor(
                        0,
                        0,
                        0
                    );
                }


            } else {

                const localWidth = 23;

                const splitText =
                    doc.splitTextToSize(
                        "Candidates must not write on this margin",
                        localWidth
                    );

                doc.setFontSize(8);

                doc.text(
                    splitText,
                    rightMargin + 2,
                    topMargin + 5
                );
            }

        }

    }


    // ==========================================
    // SAVE PDF
    // ==========================================

    window.generatedPDF =
        doc;

    doc.save(
        "QCAB.pdf"
    );
}


// ==========================================
// DOWNLOAD BUTTON
// ==========================================

document
    .getElementById("downloadPDF")
    .addEventListener(
        "click",
        () => {

            if (window.generatedPDF) {

                window.generatedPDF.save(
                    "QCAB.pdf"
                );

                document
                    .getElementById("downloadPDF")
                    .style.display =
                    "none";
            }

        }
    );