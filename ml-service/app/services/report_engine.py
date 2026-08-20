"""
Professional report generation engine for DataInsight AI.

Generates:
1. Detailed Excel workbook
2. Professional PDF analytics report

The PDF contains:
- Report information
- Executive summary
- Dataset overview
- Data quality assessment
- Column profile
- Descriptive statistics
- Correlation analysis
- Outlier analysis
- AI-generated insights
- Key findings
- Recommendations
- Conclusion
"""

import io
from datetime import datetime

import pandas as pd

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import (
    ParagraphStyle,
    getSampleStyleSheet,
)
from reportlab.lib.units import cm
from reportlab.platypus import (
    SimpleDocTemplate,
    Paragraph,
    Spacer,
    Table,
    TableStyle,
    PageBreak,
    KeepTogether,
)


# ============================================================
# Helpers
# ============================================================

def _safe(value, default="-"):
    """Return a printable value."""
    if value is None:
        return default

    if isinstance(value, float):
        if pd.isna(value):
            return default

    return value


def _fmt_number(value, decimals=2):
    """Format numbers safely."""
    try:
        if pd.isna(value):
            return "-"
        return f"{float(value):,.{decimals}f}"
    except Exception:
        return str(value)


def _escape(text):
    """Basic ReportLab XML escaping."""
    if text is None:
        return ""

    text = str(text)

    replacements = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
    }

    for old, new in replacements.items():
        text = text.replace(old, new)

    return text


def _make_table(
    data,
    col_widths=None,
    header=True,
    font_size=8,
):
    """
    Create a consistent professional table.
    """

    table = Table(
        data,
        colWidths=col_widths,
        repeatRows=1 if header else 0,
        hAlign="LEFT",
    )

    commands = [
        (
            "GRID",
            (0, 0),
            (-1, -1),
            0.4,
            colors.HexColor("#CBD5E1"),
        ),
        (
            "VALIGN",
            (0, 0),
            (-1, -1),
            "TOP",
        ),
        (
            "FONTNAME",
            (0, 0),
            (-1, -1),
            "Helvetica",
        ),
        (
            "FONTSIZE",
            (0, 0),
            (-1, -1),
            font_size,
        ),
        (
            "LEFTPADDING",
            (0, 0),
            (-1, -1),
            6,
        ),
        (
            "RIGHTPADDING",
            (0, 0),
            (-1, -1),
            6,
        ),
        (
            "TOPPADDING",
            (0, 0),
            (-1, -1),
            5,
        ),
        (
            "BOTTOMPADDING",
            (0, 0),
            (-1, -1),
            5,
        ),
    ]

    if header:
        commands.extend(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (-1, 0),
                    colors.HexColor("#0F172A"),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (-1, 0),
                    colors.white,
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (-1, 0),
                    "Helvetica-Bold",
                ),
            ]
        )

    table.setStyle(TableStyle(commands))

    return table


# ============================================================
# Excel Report
# ============================================================

def build_excel_report(
    df: pd.DataFrame,
    profile: dict,
    stats: list[dict],
) -> bytes:

    buffer = io.BytesIO()

    with pd.ExcelWriter(
        buffer,
        engine="xlsxwriter",
    ) as writer:

        workbook = writer.book

        # ----------------------------------------------------
        # Formats
        # ----------------------------------------------------

        title_format = workbook.add_format(
            {
                "bold": True,
                "font_size": 18,
                "font_color": "FFFFFF",
                "bg_color": "#0F172A",
                "align": "center",
                "valign": "vcenter",
            }
        )

        header_format = workbook.add_format(
            {
                "bold": True,
                "font_color": "FFFFFF",
                "bg_color": "#1E293B",
                "border": 1,
            }
        )

        percent_format = workbook.add_format(
            {
                "num_format": "0.00%",
            }
        )

        number_format = workbook.add_format(
            {
                "num_format": "#,##0.00",
            }
        )

        # ----------------------------------------------------
        # Sheet 1 - Data
        # ----------------------------------------------------

        df.head(5000).to_excel(
            writer,
            sheet_name="Data",
            index=False,
        )

        data_sheet = writer.sheets["Data"]

        data_sheet.freeze_panes(1, 0)
        data_sheet.autofilter(
            0,
            0,
            min(len(df.head(5000)), 5000),
            max(len(df.columns) - 1, 0),
        )

        for col_num, column in enumerate(df.columns):
            data_sheet.write(
                0,
                col_num,
                column,
                header_format,
            )

            width = min(
                max(len(str(column)) + 2, 12),
                30,
            )

            data_sheet.set_column(
                col_num,
                col_num,
                width,
            )

        # ----------------------------------------------------
        # Sheet 2 - Report Summary
        # ----------------------------------------------------

        summary_sheet = workbook.add_worksheet(
            "Report Summary"
        )

        summary_sheet.merge_range(
            "A1:D2",
            "DataInsight AI — Analytics Report",
            title_format,
        )

        summary_rows = [
            ["Metric", "Value"],
            [
                "Total Rows",
                profile.get("row_count", 0),
            ],
            [
                "Total Columns",
                profile.get("column_count", 0),
            ],
            [
                "Duplicate Rows",
                profile.get("duplicate_count", 0),
            ],
            [
                "Missing Cells",
                profile.get("missing_cells", 0),
            ],
            [
                "Missing Percentage",
                profile.get("missing_pct", 0),
            ],
            [
                "Numerical Columns",
                len(profile.get("numerical_columns", [])),
            ],
            [
                "Categorical Columns",
                len(profile.get("categorical_columns", [])),
            ],
            [
                "Datetime Columns",
                len(profile.get("datetime_columns", [])),
            ],
            [
                "Text Columns",
                len(profile.get("text_columns", [])),
            ],
        ]

        for row, values in enumerate(summary_rows, start=3):
            for col, value in enumerate(values):
                if row == 3:
                    summary_sheet.write(
                        row - 1,
                        col,
                        value,
                        header_format,
                    )
                else:
                    summary_sheet.write(
                        row - 1,
                        col,
                        value,
                    )

        summary_sheet.set_column("A:A", 28)
        summary_sheet.set_column("B:B", 35)

        # ----------------------------------------------------
        # Sheet 3 - Column Profile
        # ----------------------------------------------------

        profile_df = pd.DataFrame(
            profile.get("columns", [])
        )

        if not profile_df.empty:
            profile_df.to_excel(
                writer,
                sheet_name="Column Profile",
                index=False,
            )

            sheet = writer.sheets["Column Profile"]

            for col_num, column in enumerate(
                profile_df.columns
            ):
                sheet.write(
                    0,
                    col_num,
                    column,
                    header_format,
                )

                sheet.set_column(
                    col_num,
                    col_num,
                    min(
                        max(len(str(column)) + 3, 15),
                        35,
                    ),
                )

            sheet.freeze_panes(1, 0)

        # ----------------------------------------------------
        # Sheet 4 - Descriptive Statistics
        # ----------------------------------------------------

        if stats:

            stats_df = pd.DataFrame(stats)

            stats_df.to_excel(
                writer,
                sheet_name="Descriptive Stats",
                index=False,
            )

            sheet = writer.sheets["Descriptive Stats"]

            for col_num, column in enumerate(
                stats_df.columns
            ):
                sheet.write(
                    0,
                    col_num,
                    column,
                    header_format,
                )

                sheet.set_column(
                    col_num,
                    col_num,
                    16,
                )

            sheet.freeze_panes(1, 0)

    buffer.seek(0)

    return buffer.read()


# ============================================================
# PDF Report
# ============================================================

def build_pdf_report(
    filename: str,
    profile: dict,
    stats: list[dict],
    correlation: dict,
    outliers: dict,
    insights: list[dict],
    summary_text: str,
) -> bytes:

    buffer = io.BytesIO()

    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=1.5 * cm,
        leftMargin=1.5 * cm,
        topMargin=1.5 * cm,
        bottomMargin=1.5 * cm,
        title="DataInsight AI Analytics Report",
        author="DataInsight AI",
    )

    # ========================================================
    # Styles
    # ========================================================

    base_styles = getSampleStyleSheet()

    title_style = ParagraphStyle(
        "ReportTitle",
        parent=base_styles["Title"],
        fontName="Helvetica-Bold",
        fontSize=24,
        leading=30,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#0F172A"),
        spaceAfter=10,
    )

    subtitle_style = ParagraphStyle(
        "ReportSubtitle",
        parent=base_styles["Normal"],
        fontSize=10,
        leading=15,
        alignment=TA_CENTER,
        textColor=colors.HexColor("#64748B"),
        spaceAfter=20,
    )

    heading_style = ParagraphStyle(
        "ReportHeading",
        parent=base_styles["Heading2"],
        fontName="Helvetica-Bold",
        fontSize=15,
        leading=20,
        textColor=colors.HexColor("#0F172A"),
        spaceBefore=10,
        spaceAfter=8,
    )

    subheading_style = ParagraphStyle(
        "ReportSubHeading",
        parent=base_styles["Heading3"],
        fontName="Helvetica-Bold",
        fontSize=11,
        leading=15,
        textColor=colors.HexColor("#334155"),
        spaceBefore=7,
        spaceAfter=5,
    )

    body_style = ParagraphStyle(
        "ReportBody",
        parent=base_styles["BodyText"],
        fontSize=9,
        leading=14,
        textColor=colors.HexColor("#334155"),
        spaceAfter=6,
    )

    small_style = ParagraphStyle(
        "ReportSmall",
        parent=base_styles["BodyText"],
        fontSize=7.5,
        leading=10,
        textColor=colors.HexColor("#475569"),
    )

    bullet_style = ParagraphStyle(
        "ReportBullet",
        parent=body_style,
        leftIndent=12,
        firstLineIndent=-7,
        bulletIndent=0,
        spaceAfter=4,
    )

    story = []

    # ========================================================
    # Cover Page
    # ========================================================

    story.append(Spacer(1, 3 * cm))

    story.append(
        Paragraph(
            "DataInsight AI",
            title_style,
        )
    )

    story.append(
        Paragraph(
            "Comprehensive Data Analytics Report",
            ParagraphStyle(
                "CoverSubtitle",
                parent=subtitle_style,
                fontSize=15,
                textColor=colors.HexColor("#334155"),
            ),
        )
    )

    story.append(Spacer(1, 1 * cm))

    cover_data = [
        ["Report", "Data Analytics & Intelligence"],
        ["Source File", _escape(filename)],
        [
            "Generated On",
            datetime.now().strftime(
                "%d %B %Y, %I:%M %p"
            ),
        ],
        [
            "Dataset Size",
            f"{profile.get('row_count', 0):,} rows × "
            f"{profile.get('column_count', 0)} columns",
        ],
    ]

    cover_table = _make_table(
        cover_data,
        col_widths=[
            5 * cm,
            11 * cm,
        ],
        header=False,
        font_size=9,
    )

    cover_table.setStyle(
        TableStyle(
            [
                (
                    "BACKGROUND",
                    (0, 0),
                    (0, -1),
                    colors.HexColor("#0F172A"),
                ),
                (
                    "TEXTCOLOR",
                    (0, 0),
                    (0, -1),
                    colors.white,
                ),
                (
                    "FONTNAME",
                    (0, 0),
                    (0, -1),
                    "Helvetica-Bold",
                ),
            ]
        )
    )

    story.append(cover_table)

    story.append(Spacer(1, 2 * cm))

    story.append(
        Paragraph(
            "Generated by DataInsight AI — automated statistical "
            "profiling, data quality assessment and AI-assisted insights.",
            subtitle_style,
        )
    )

    story.append(PageBreak())

    # ========================================================
    # 1. Executive Summary
    # ========================================================

    story.append(
        Paragraph(
            "1. Executive Summary",
            heading_style,
        )
    )

    story.append(
        Paragraph(
            _escape(summary_text),
            body_style,
        )
    )

    # KPI table

    kpi_data = [
        ["Metric", "Value"],
        [
            "Records",
            f"{profile.get('row_count', 0):,}",
        ],
        [
            "Columns",
            f"{profile.get('column_count', 0):,}",
        ],
        [
            "Data Completeness",
            f"{100 - profile.get('missing_pct', 0):.2f}%",
        ],
        [
            "Duplicate Records",
            f"{profile.get('duplicate_count', 0):,}",
        ],
    ]

    story.append(
        _make_table(
            kpi_data,
            col_widths=[
                7 * cm,
                9 * cm,
            ],
        )
    )

    story.append(Spacer(1, 10))

    # ========================================================
    # 2. Dataset Overview
    # ========================================================

    story.append(
        Paragraph(
            "2. Dataset Overview",
            heading_style,
        )
    )

    overview_data = [
        ["Property", "Value"],
        [
            "Total Rows",
            f"{profile.get('row_count', 0):,}",
        ],
        [
            "Total Columns",
            f"{profile.get('column_count', 0):,}",
        ],
        [
            "Duplicate Rows",
            f"{profile.get('duplicate_count', 0):,}",
        ],
        [
            "Missing Cells",
            f"{profile.get('missing_cells', 0):,}",
        ],
        [
            "Missing Percentage",
            f"{profile.get('missing_pct', 0):.2f}%",
        ],
        [
            "Numerical Columns",
            f"{len(profile.get('numerical_columns', []))}",
        ],
        [
            "Categorical Columns",
            f"{len(profile.get('categorical_columns', []))}",
        ],
        [
            "Datetime Columns",
            f"{len(profile.get('datetime_columns', []))}",
        ],
        [
            "Text Columns",
            f"{len(profile.get('text_columns', []))}",
        ],
    ]

    story.append(
        _make_table(
            overview_data,
            col_widths=[
                7 * cm,
                9 * cm,
            ],
        )
    )

    # ========================================================
    # 3. Data Quality Assessment
    # ========================================================

    story.append(
        Paragraph(
            "3. Data Quality Assessment",
            heading_style,
        )
    )

    completeness = 100 - profile.get(
        "missing_pct",
        0,
    )

    if completeness >= 95:
        quality_status = "Excellent"
    elif completeness >= 90:
        quality_status = "Good"
    elif completeness >= 75:
        quality_status = "Moderate"
    else:
        quality_status = "Needs Attention"

    quality_data = [
        ["Quality Metric", "Result", "Assessment"],
        [
            "Completeness",
            f"{completeness:.2f}%",
            quality_status,
        ],
        [
            "Missing Cells",
            f"{profile.get('missing_cells', 0):,}",
            "Review affected columns"
            if profile.get("missing_cells", 0) > 0
            else "No missing cells",
        ],
        [
            "Duplicate Records",
            f"{profile.get('duplicate_count', 0):,}",
            "Review duplicates"
            if profile.get("duplicate_count", 0) > 0
            else "No duplicates",
        ],
    ]

    story.append(
        _make_table(
            quality_data,
            col_widths=[
                5.5 * cm,
                4.5 * cm,
                6 * cm,
            ],
        )
    )

    # ========================================================
    # 4. Column Profile
    # ========================================================

    story.append(
        Paragraph(
            "4. Column-Level Data Profile",
            heading_style,
        )
    )

    columns = profile.get("columns", [])

    if columns:

        profile_table = [
            [
                "Column",
                "Data Type",
                "Inferred Type",
                "Missing",
                "Unique",
            ]
        ]

        for column in columns:

            profile_table.append(
                [
                    _escape(column.get("name", "-")),
                    _escape(column.get("dtype", "-")),
                    _escape(
                        column.get(
                            "inferred_type",
                            "-",
                        )
                    ),
                    f"{column.get('missing_pct', 0):.2f}%",
                    f"{column.get('unique_count', 0):,}",
                ]
            )

        story.append(
            _make_table(
                profile_table,
                col_widths=[
                    4.5 * cm,
                    3.5 * cm,
                    3.5 * cm,
                    2.5 * cm,
                    2.5 * cm,
                ],
                font_size=7,
            )
        )

    # ========================================================
    # 5. Numerical Analysis
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "5. Numerical Analysis",
            heading_style,
        )
    )

    if stats:

        stats_table = [
            [
                "Column",
                "Count",
                "Mean",
                "Std",
                "Min",
                "25%",
                "Median",
                "75%",
                "Max",
                "Skew",
            ]
        ]

        for row in stats:

            stats_table.append(
                [
                    _escape(row.get("column", "-")),
                    _fmt_number(row.get("count")),
                    _fmt_number(row.get("mean")),
                    _fmt_number(row.get("std")),
                    _fmt_number(row.get("min")),
                    _fmt_number(row.get("25%")),
                    _fmt_number(row.get("50%")),
                    _fmt_number(row.get("75%")),
                    _fmt_number(row.get("max")),
                    _fmt_number(row.get("skew")),
                ]
            )

        story.append(
            _make_table(
                stats_table,
                col_widths=[
                    3.1 * cm,
                    1.4 * cm,
                    1.7 * cm,
                    1.7 * cm,
                    1.7 * cm,
                    1.7 * cm,
                    1.7 * cm,
                    1.7 * cm,
                    1.7 * cm,
                    1.5 * cm,
                ],
                font_size=6.5,
            )
        )

    else:

        story.append(
            Paragraph(
                "No numerical columns were detected, so "
                "descriptive numerical statistics are not available.",
                body_style,
            )
        )

    # ========================================================
    # 6. Correlation Analysis
    # ========================================================

    story.append(
        Paragraph(
            "6. Correlation Analysis",
            heading_style,
        )
    )

    corr_columns = correlation.get(
        "columns",
        [],
    )

    corr_matrix = correlation.get(
        "matrix",
        [],
    )

    if corr_columns and corr_matrix:

        corr_table = [
            ["Variable"] + [
                _escape(str(c))
                for c in corr_columns
            ]
        ]

        for i, column in enumerate(
            corr_columns
        ):

            row = [
                _escape(str(column))
            ]

            values = corr_matrix[i]

            for value in values:
                row.append(
                    _fmt_number(
                        value,
                        3,
                    )
                )

            corr_table.append(row)

        available_width = 17 * cm

        col_width = min(
            3 * cm,
            available_width / max(
                len(corr_columns) + 1,
                1,
            ),
        )

        story.append(
            _make_table(
                corr_table,
                col_widths=[
                    col_width
                    for _ in corr_table[0]
                ],
                font_size=6.5,
            )
        )

        # Find strongest relationships

        pairs = []

        for i in range(
            len(corr_columns)
        ):
            for j in range(
                i + 1,
                len(corr_columns),
            ):

                try:
                    value = float(
                        corr_matrix[i][j]
                    )

                    pairs.append(
                        (
                            abs(value),
                            value,
                            corr_columns[i],
                            corr_columns[j],
                        )
                    )

                except Exception:
                    pass

        pairs.sort(
            reverse=True
        )

        if pairs:

            story.append(
                Spacer(1, 8)
            )

            story.append(
                Paragraph(
                    "<b>Strongest relationships</b>",
                    subheading_style,
                )
            )

            for _, value, a, b in pairs[:5]:

                if abs(value) >= 0.7:
                    strength = "strong"
                elif abs(value) >= 0.4:
                    strength = "moderate"
                else:
                    strength = "weak"

                direction = (
                    "positive"
                    if value > 0
                    else "negative"
                )

                story.append(
                    Paragraph(
                        f"• <b>{_escape(a)}</b> and "
                        f"<b>{_escape(b)}</b> show a "
                        f"{strength} {direction} relationship "
                        f"(r = {_fmt_number(value, 3)}).",
                        bullet_style,
                    )
                )

    else:

        story.append(
            Paragraph(
                "Correlation analysis is not available "
                "because the dataset does not contain enough "
                "numerical variables.",
                body_style,
            )
        )

    # ========================================================
    # 7. Outlier Analysis
    # ========================================================

    story.append(
        Paragraph(
            "7. Outlier Analysis",
            heading_style,
        )
    )

    if outliers:

        outlier_table = [
            [
                "Column",
                "Outliers",
                "Percentage",
                "Lower Bound",
                "Upper Bound",
            ]
        ]

        total_outliers = 0

        for column, info in outliers.items():

            count = info.get(
                "count",
                0,
            )

            total_outliers += count

            outlier_table.append(
                [
                    _escape(column),
                    f"{count:,}",
                    f"{info.get('pct', 0):.2f}%",
                    _fmt_number(
                        info.get(
                            "lower_bound"
                        )
                    ),
                    _fmt_number(
                        info.get(
                            "upper_bound"
                        )
                    ),
                ]
            )

        story.append(
            _make_table(
                outlier_table,
                col_widths=[
                    5 * cm,
                    3 * cm,
                    3 * cm,
                    3 * cm,
                    3 * cm,
                ],
            )
        )

        story.append(
            Spacer(1, 8)
        )

        story.append(
            Paragraph(
                f"<b>Total detected outlier observations:</b> "
                f"{total_outliers:,}",
                body_style,
            )
        )

        for column, info in outliers.items():

            if info.get("count", 0) > 0:

                suggestion = info.get(
                    "treatment_suggestion",
                    "Investigate these observations.",
                )

                story.append(
                    Paragraph(
                        f"• <b>{_escape(column)}</b>: "
                        f"{_escape(suggestion)}",
                        bullet_style,
                    )
                )

    else:

        story.append(
            Paragraph(
                "No outlier information was generated.",
                body_style,
            )
        )

    # ========================================================
    # 8. AI-Generated Insights
    # ========================================================

    story.append(
        PageBreak()
    )

    story.append(
        Paragraph(
            "8. AI-Generated Insights",
            heading_style,
        )
    )

    if insights:

        for index, item in enumerate(
            insights,
            start=1,
        ):

            title = _escape(
                item.get(
                    "title",
                    f"Insight {index}",
                )
            )

            detail = _escape(
                item.get(
                    "detail",
                    "",
                )
            )

            insight_type = _escape(
                item.get(
                    "type",
                    "analysis",
                )
            )

            insight_data = [
                [
                    "Insight",
                    f"{index}. {title}",
                ],
                [
                    "Category",
                    insight_type.replace(
                        "_",
                        " ",
                    ).title(),
                ],
                [
                    "Analysis",
                    Paragraph(
                        detail,
                        small_style,
                    ),
                ],
            ]

            insight_table = _make_table(
                insight_data,
                col_widths=[
                    4 * cm,
                    12 * cm,
                ],
                header=False,
                font_size=8,
            )

            insight_table.setStyle(
                TableStyle(
                    [
                        (
                            "BACKGROUND",
                            (0, 0),
                            (0, -1),
                            colors.HexColor(
                                "#E2E8F0"
                            ),
                        ),
                        (
                            "FONTNAME",
                            (0, 0),
                            (0, -1),
                            "Helvetica-Bold",
                        ),
                    ]
                )
            )

            story.append(
                KeepTogether(
                    [
                        insight_table,
                        Spacer(1, 8),
                    ]
                )
            )

    else:

        story.append(
            Paragraph(
                "No automated insights were generated.",
                body_style,
            )
        )

    # ========================================================
    # 9. Key Findings
    # ========================================================

    story.append(
        Paragraph(
            "9. Key Findings",
            heading_style,
        )
    )

    findings = []

    if profile.get("missing_pct", 0) > 0:

        findings.append(
            f"The dataset contains "
            f"{profile.get('missing_pct', 0):.2f}% "
            f"missing cells."
        )

    if profile.get("duplicate_count", 0) > 0:

        findings.append(
            f"{profile.get('duplicate_count', 0):,} "
            f"duplicate records were identified."
        )

    if stats:

        for row in stats:

            skew = row.get(
                "skew",
                0,
            )

            try:
                skew = float(skew)
            except Exception:
                skew = 0

            if abs(skew) > 1:

                direction = (
                    "right"
                    if skew > 0
                    else "left"
                )

                findings.append(
                    f"{row.get('column')} has a "
                    f"{direction}-skewed distribution "
                    f"(skew = {skew:.2f})."
                )

    if not findings:

        findings.append(
            "No major structural data-quality issues "
            "were identified in the automated analysis."
        )

    for finding in findings[:10]:

        story.append(
            Paragraph(
                f"• {_escape(finding)}",
                bullet_style,
            )
        )

    # ========================================================
    # 10. Recommendations
    # ========================================================

    story.append(
        Paragraph(
            "10. Recommendations",
            heading_style,
        )
    )

    recommendations = []

    if profile.get("missing_pct", 0) > 5:

        recommendations.append(
            "Review columns with high missing-value "
            "percentages and apply an appropriate "
            "imputation or removal strategy."
        )

    if profile.get("duplicate_count", 0) > 0:

        recommendations.append(
            "Investigate duplicate records before "
            "performing downstream modeling or KPI analysis."
        )

    if outliers:

        outlier_columns = [
            column
            for column, info in outliers.items()
            if info.get("count", 0) > 0
        ]

        if outlier_columns:

            recommendations.append(
                "Investigate detected outliers before "
                "making business decisions or training "
                "statistical models."
            )

    if correlation.get("matrix"):

        recommendations.append(
            "Review strongly correlated numerical "
            "variables for potential redundancy or "
            "multicollinearity in predictive models."
        )

    if profile.get("datetime_columns"):

        recommendations.append(
            "Use the available datetime fields for "
            "trend, seasonality and forecasting analysis."
        )

    recommendations.append(
        "Combine the statistical findings in this report "
        "with domain knowledge before making important "
        "business decisions."
    )

    for recommendation in recommendations:

        story.append(
            Paragraph(
                f"• {_escape(recommendation)}",
                bullet_style,
            )
        )

    # ========================================================
    # 11. Data Limitations
    # ========================================================

    story.append(
        Paragraph(
            "11. Data Limitations",
            heading_style,
        )
    )

    limitations = [
        "Automated statistical analysis does not replace "
        "domain-specific validation.",
        "Correlation does not establish causation.",
        "Outlier detection uses the IQR-based statistical "
        "method and may flag legitimate extreme observations.",
        "AI-generated insights should be reviewed before "
        "being used for high-impact decisions.",
    ]

    if profile.get("missing_pct", 0) > 0:

        limitations.append(
            "Missing values may affect the reliability of "
            "some statistical conclusions."
        )

    for limitation in limitations:

        story.append(
            Paragraph(
                f"• {_escape(limitation)}",
                bullet_style,
            )
        )

    # ========================================================
    # 12. Conclusion
    # ========================================================

    story.append(
        Paragraph(
            "12. Conclusion",
            heading_style,
        )
    )

    conclusion = (
        f"The analysis covered a dataset containing "
        f"{profile.get('row_count', 0):,} records and "
        f"{profile.get('column_count', 0)} variables. "
        f"The report evaluated data quality, column "
        f"characteristics, descriptive statistics, "
        f"relationships between numerical variables, "
        f"potential outliers and automatically generated "
        f"analytical insights."
    )

    story.append(
        Paragraph(
            _escape(conclusion),
            body_style,
        )
    )

    story.append(Spacer(1, 12))

    story.append(
        Paragraph(
            "End of Report",
            ParagraphStyle(
                "EndReport",
                parent=subtitle_style,
                alignment=TA_CENTER,
                fontSize=8,
            ),
        )
    )

    # ========================================================
    # Build PDF
    # ========================================================

    doc.build(story)

    buffer.seek(0)

    return buffer.read()