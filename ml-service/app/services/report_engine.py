"""
Lightweight report generation: an Excel workbook (raw data + summary stats)
and a PDF summary report (data quality + AI insights). Kept intentionally
simple relative to the analytics engine per project priority.
"""
import io
import pandas as pd
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib import colors


def build_excel_report(df: pd.DataFrame, profile: dict, stats: list[dict]) -> bytes:
    buffer = io.BytesIO()
    with pd.ExcelWriter(buffer, engine="xlsxwriter") as writer:
        df.head(5000).to_excel(writer, sheet_name="Data", index=False)
        pd.DataFrame(profile["columns"]).to_excel(writer, sheet_name="Column Profile", index=False)
        if stats:
            pd.DataFrame(stats).to_excel(writer, sheet_name="Descriptive Stats", index=False)
    buffer.seek(0)
    return buffer.read()


def build_pdf_report(filename: str, profile: dict, insights: list[dict], summary_text: str) -> bytes:
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, topMargin=2 * cm, bottomMargin=2 * cm)
    styles = getSampleStyleSheet()
    story = []

    story.append(Paragraph("DataInsight AI — Report", styles["Title"]))
    story.append(Paragraph(f"Source file: {filename}", styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Executive Summary", styles["Heading2"]))
    story.append(Paragraph(summary_text, styles["Normal"]))
    story.append(Spacer(1, 12))

    story.append(Paragraph("Dataset Overview", styles["Heading2"]))
    overview_data = [
        ["Rows", profile["row_count"]],
        ["Columns", profile["column_count"]],
        ["Duplicate rows", profile["duplicate_count"]],
        ["Missing cells", f"{profile['missing_cells']} ({profile['missing_pct']}%)"],
        ["Numerical columns", ", ".join(profile["numerical_columns"]) or "-"],
        ["Categorical columns", ", ".join(profile["categorical_columns"]) or "-"],
        ["Datetime columns", ", ".join(profile["datetime_columns"]) or "-"],
    ]
    table = Table(overview_data, colWidths=[4 * cm, 12 * cm])
    table.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#1e293b")),
        ("TEXTCOLOR", (0, 0), (0, -1), colors.white),
        ("GRID", (0, 0), (-1, -1), 0.5, colors.grey),
        ("FONTSIZE", (0, 0), (-1, -1), 9),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    story.append(table)
    story.append(Spacer(1, 12))

    story.append(Paragraph("AI-Generated Insights", styles["Heading2"]))
    for item in insights:
        story.append(Paragraph(f"<b>{item['title']}</b>", styles["Normal"]))
        story.append(Paragraph(item["detail"], styles["Normal"]))
        story.append(Spacer(1, 6))

    doc.build(story)
    buffer.seek(0)
    return buffer.read()
