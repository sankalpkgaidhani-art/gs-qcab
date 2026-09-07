import json
import csv

# =========================================
# READ QUESTIONS.JSON
# =========================================

with open("questions.json", "r", encoding="utf-8") as file:
    data = json.load(file)

questions = data["questions_repository"]


# =========================================
# CREATE CSV
# =========================================

with open(
    "questions.csv",
    "w",
    newline="",
    encoding="utf-8-sig"
) as file:

    writer = csv.writer(file)

    # Header
    writer.writerow([
        "paper",
        "topic",
        "year",
        "marks",
        "question_text"
    ])

    # Questions
    for question in questions:

        writer.writerow([
            question.get("paper", ""),
            question.get("topic", ""),
            question.get("year", ""),
            question.get("marks", ""),
            question.get("question_text", "")
        ])


# =========================================
# DONE
# =========================================

print()
print("=========================================")
print(f"Successfully converted {len(questions)} questions.")
print("Created: questions.csv")
print("=========================================")