# Canadian Tax-Document PII Redaction Test Corpus

Realistic, accurately-formatted text representations of common Canadian tax documents,
populated with SAMPLE / FAKE data for stress-testing a PII redaction tool.

All names, SINs, business numbers, addresses, phone numbers, emails, and account
numbers below are FABRICATED for testing. SINs use the 130-692-xxx range (a known
test/sample range) and similar non-issued patterns. No real taxpayer data is present.

Each section is wrapped in a `### SAMPLE:` header followed by the document body, then a
`<!-- GROUND_TRUTH ... -->` block listing every piece of PII a human reviewer would
strip, by category, plus an `amounts_to_KEEP` line for values that must NOT be redacted.

Formatting quirks deliberately included:
- Box-numbered fields ("Box 14: 52,000.00")
- Columnar / table layouts with values in cells
- SINs in three formats: `123 456 789`, `123-456-789`, `123456789`
- Business numbers in RC / RT / RP / RZ program-account variants
- Bilingual labels ("Nom/Name", "Année/Year")
- Amounts with `$`, without `$`, with and without thousands separators
- French-accented names (Geneviève Bélanger, Réjean Côté)
- PII in unusual positions (name inside a table cell, SIN mid-sentence)

---

### SAMPLE: T4 Statement of Remuneration Paid

```
                                                    Protected B when completed
                                                    Protégé B une fois rempli
Canada Revenue        Agence du revenu
Agency                du Canada

                  T4  Statement of Remuneration Paid
                      État de la rémunération payée                    2025

Employer's name – Nom de l'employeur
NORTHWIND LOGISTICS INC.

                                              Year         Box 54  Business Number
                                              Année        Numéro d'entreprise
                                              2025          12 3456 789 RP 0001

Employee's name and address – Nom et adresse de l'employé
Last name (in capital letters) – Nom de famille (en lettres moulées)   First name – Prénom   Initial
TREMBLAY                                                                Jean                  M
4521 Rue Sainte-Catherine, Apt 7
Montréal QC  H2W 1Y6

Social insurance number          Exempt – Exemption    Employment code
Numéro d'assurance sociale       CPP/QPP  EI   PPIP    Code d'emploi
   130 692 544                      [ ]   [ ]   [ ]

 Box 14  Employment income          Box 22  Income tax deducted
 Case 14  Revenus d'emploi          Case 22  Impôt sur le revenu retenu
          52,000.00                          7,845.20

 Box 16  Employee's CPP contributions     Box 18  Employee's EI premiums
          3,754.45                                  1,002.45

 Box 24  EI insurable earnings      Box 26  CPP/QPP pensionable earnings
          61,500.00                          61,500.00

 Box 44  Union dues                 Box 46  Charitable donations
          642.00                             250.00

 Box 20  RPP contributions          Box 52  Pension adjustment
          1,800.00                           3,600
```

<!-- GROUND_TRUTH
names: Jean M Tremblay
employer_names: Northwind Logistics Inc.
sins: 130 692 544
business_numbers: 12 3456 789 RP 0001 (123456789RP0001)
postal_codes: H2W 1Y6
phones: (none)
emails: (none)
addresses: 4521 Rue Sainte-Catherine, Apt 7, Montréal QC H2W 1Y6
health_numbers: (none)
amounts_to_KEEP: 52000.00, 7845.20, 3754.45, 1002.45, 61500.00, 642.00, 250.00, 1800.00, 3600
-->

---

### SAMPLE: T4A Statement of Pension, Retirement, Annuity, and Other Income

```
Canada Revenue   Agence du revenu                Protected B when completed
Agency           du Canada                       Protégé B une fois rempli

   T4A  Statement of Pension, Retirement, Annuity, and Other Income
        État du revenu de pension, de retraite, de rente
        ou d'autres sources                                       2025

Payer's name – Nom du payeur
BELANGER CONSULTING / CONSEIL BÉLANGER

                              Year/Année  2025

Recipient's name (last, first) – Nom du bénéficiaire (de famille, prénom)
BÉLANGER, Geneviève
118 Promenade du Portage
Gatineau QC  J8X 2K1

Social insurance number   Recipient's account number / program
N.A.S.  130-692-545        Account no.: 98 7654 321 RZ 0002

  Box 016  Pension or superannuation        Box 018  Lump-sum payments
            18,400.00                                   0.00
  Box 020  Self-employed commissions        Box 022  Income tax deducted
            12,750.00                                  2,100.00
  Box 048  Fees for services                Box 105  Scholarships/bursaries
            34,250.00                                  0.00
```

<!-- GROUND_TRUTH
names: Geneviève Bélanger
payer_names: Bélanger Consulting / Conseil Bélanger
sins: 130-692-545
business_numbers: 98 7654 321 RZ 0002 (987654321RZ0002)
postal_codes: J8X 2K1
phones: (none)
emails: (none)
addresses: 118 Promenade du Portage, Gatineau QC J8X 2K1
health_numbers: (none)
amounts_to_KEEP: 18400.00, 0.00, 12750.00, 2100.00, 34250.00
-->

---

### SAMPLE: T5 Statement of Investment Income

```
Canada Revenue  Agence du revenu               Protected B when completed
Agency          du Canada

  T5  Statement of Investment Income  /  État des revenus de placements      2025

  Dividends from Canadian corporations – Dividendes de sociétés canadiennes
  Box 24  Actual amount of eligible dividends ........  1,274.55
  Box 25  Taxable amount of eligible dividends .......  1,759.88
  Box 26  Dividend tax credit for eligible dividends .    263.71

  Box 13  Interest from Canadian sources ............     842.10
  Box 18  Capital gains dividends ..................      0.00

Recipient's name and address / Nom et adresse du bénéficiaire
Marie-Claude Côté
77 Sparks Street, Suite 400
Ottawa ON  K1P 5A5

Recipient identification number / Numéro d'identification
Social insurance number (SIN): 130692546

Payer's name and address / Nom et adresse du payeur
ROYAL TRUST INVESTMENT SERVICES
Account: 0042-117-8893
```

<!-- GROUND_TRUTH
names: Marie-Claude Côté
payer_names: Royal Trust Investment Services
sins: 130692546
business_numbers: (none)
account_numbers: 0042-117-8893
postal_codes: K1P 5A5
phones: (none)
emails: (none)
addresses: 77 Sparks Street, Suite 400, Ottawa ON K1P 5A5
health_numbers: (none)
amounts_to_KEEP: 1274.55, 1759.88, 263.71, 842.10, 0.00
-->

---

### SAMPLE: T3 Statement of Trust Income Allocations and Designations

```
Canada Revenue  Agence du revenu              Protected B when completed
Agency          du Canada

  T3  Statement of Trust Income Allocations and Designations
      État des revenus de fiducie (répartitions et attributions)      2025

  Box 49  Actual amount of eligible dividends .......   3,210.00
  Box 50  Taxable amount of eligible dividends ......   4,429.80
  Box 51  Dividend tax credit ......................      663.99
  Box 21  Capital gains .............................   9,875.40
  Box 26  Other income ..............................   1,150.00

Beneficiary
  Name:  Réjean Côté
  Address:  12-3400 Boulevard Henri-Bourassa
            Québec QC  G1H 3A9
  SIN / NAS:  130 692 547

Trust account number / Numéro de compte de fiducie:  T 9 8 7 6 5 4 3 2 1
Trustee:  ESTATE OF ARMAND CÔTÉ
```

<!-- GROUND_TRUTH
names: Réjean Côté, Armand Côté
sins: 130 692 547
business_numbers: (none)
trust_account_numbers: T98765432 1 (T987654321)
postal_codes: G1H 3A9
phones: (none)
emails: (none)
addresses: 12-3400 Boulevard Henri-Bourassa, Québec QC G1H 3A9
health_numbers: (none)
amounts_to_KEEP: 3210.00, 4429.80, 663.99, 9875.40, 1150.00
-->

---

### SAMPLE: T1 General Income Tax and Benefit Return (Identification page)

```
                                  Protected B when completed
Income Tax and Benefit Return                                       2025
T1 GENERAL

Identification
First name and initial            Last name
Aanya                             Patel

Social insurance number (SIN)     Date of birth (Year/Month/Day)
1 3 0  6 9 2  5 4 8               1991/03/14

Mailing address: Apt No – Street No  Street name
                 Unit 802 - 250 Yonge Street
City                              Prov./Terr.   Postal code
Toronto                           ON            M5B 2L7

Email address: aanya.patel@example.ca
Phone: 416-555-0142

Marital status on December 31, 2025:   [X] 1 Married   [ ] 2 Living common-law   [ ] 4 Single

Information about your residence
Province or territory of residence on December 31, 2025:  Ontario

Total income
 Line 10100  Employment income (box 14 of all T4 slips) .........  52,000 00
 Line 12000  Taxable amount of dividends .....................     1,759 88
 Line 12100  Interest and other investment income ............       842 10
 Line 15000  Total income ....................................    54,601 98

Refund or balance owing
 Line 43500  Total payable ...................................     8,940 12
 Line 43700  Total income tax deducted .......................     9,945 20
 Line 48400  Refund ..........................................     1,005 08
```

<!-- GROUND_TRUTH
names: Aanya Patel
sins: 1 3 0 6 9 2 5 4 8 (130692548)
business_numbers: (none)
dates_of_birth: 1991/03/14
postal_codes: M5B 2L7
phones: 416-555-0142
emails: aanya.patel@example.ca
addresses: Unit 802 - 250 Yonge Street, Toronto ON M5B 2L7
health_numbers: (none)
amounts_to_KEEP: 52000.00, 1759.88, 842.10, 54601.98, 8940.12, 9945.20, 1005.08
-->

---

### SAMPLE: T2 Corporation Income Tax Return (Identification + key lines)

```
Canada Revenue  Agence du revenu             Protected B when completed
Agency          du Canada

  T2 Corporation Income Tax Return – This form serves as a federal and provincial
  return where the corporation has a permanent establishment.

  Identification
  Business number (BN) ........................  8 6 7 5 3 0 9 0 9  RC 0001
  Corporation's name
  CEDAR & OAK HOLDINGS LTD.
  Address of head office
  Has this address changed since the last time we were notified?  [ ] Yes [X] No
    1200 - 401 West Georgia Street
    Vancouver BC  V6B 5A1

  Mailing address (if different from head office)
    PO Box 4910 STN Terminal
    Vancouver BC  V6B 4A8

  Tax year start  2025-01-01      Tax year-end  2025-12-31

  Person to contact for more information:
    Name:  David O'Sullivan
    Phone: (604) 555-0188

  Line 040  Type of corporation: [X] 1 Canadian-controlled private corporation (CCPC)

  Attachments / financial summary
  Line 300  Net income (loss) for income tax purposes .....   245,800.00
  Line 360  Taxable income ...............................    245,800.00
  Line 700  Total federal tax ............................     45,473.00
```

<!-- GROUND_TRUTH
names: David O'Sullivan
corporation_names: Cedar & Oak Holdings Ltd.
sins: (none)
business_numbers: 8 6 7 5 3 0 9 0 9 RC 0001 (867530909RC0001)
postal_codes: V6B 5A1, V6B 4A8
phones: (604) 555-0188
emails: (none)
addresses: 1200 - 401 West Georgia Street, Vancouver BC V6B 5A1; PO Box 4910 STN Terminal, Vancouver BC V6B 4A8
dates_to_KEEP_or_redact_per_policy: 2025-01-01, 2025-12-31 (fiscal period, usually KEEP)
health_numbers: (none)
amounts_to_KEEP: 245800.00, 45473.00
-->

---

### SAMPLE: GST34 / GST62 Goods and Services Tax / Harmonized Sales Tax Return

```
Canada Revenue  Agence du revenu
Agency          du Canada

  Goods and Services Tax / Harmonized Sales Tax (GST/HST) Return for Registrants
  Déclaration de la taxe sur les produits et services / taxe de vente harmonisée

  Business Number     Reporting period            Due date
  Numéro d'entreprise From          To
  123456789 RT 0001   2025-01-01    2025-03-31     2025-04-30

  Name:  PRAIRIE ROSE BAKERY LTD.
         Owner: Oluwaseun Adeyemi
         88 Osborne Street
         Winnipeg MB  R3L 1Y5

  Part 1 – Calculation
  101  Sales and other revenue (do not include GST/HST) ......  185,400.00
  103  GST/HST collected and collectible .....................    9,270.00
  104  Adjustments ...........................................        0.00
  105  Total GST/HST and adjustments (101 + 104) .............    9,270.00
  106  GST/HST paid on purchases (ITCs) ......................    3,415.50
  108  Total ITCs and adjustments ............................    3,415.50
  109  Net tax (105 minus 108) ...............................    5,854.50
  115  Balance (line 109 + other) ............................    5,854.50

  I certify that the information given on this return is true.
  Signature ____________________   Telephone 204-555-0177
```

<!-- GROUND_TRUTH
names: Oluwaseun Adeyemi
business_names: Prairie Rose Bakery Ltd.
sins: (none)
business_numbers: 123456789 RT 0001 (123456789RT0001)
postal_codes: R3L 1Y5
phones: 204-555-0177
emails: (none)
addresses: 88 Osborne Street, Winnipeg MB R3L 1Y5
health_numbers: (none)
dates_to_KEEP_per_policy: 2025-01-01, 2025-03-31, 2025-04-30 (reporting period)
amounts_to_KEEP: 185400.00, 9270.00, 0.00, 3415.50, 5854.50
-->

---

### SAMPLE: Notice of Assessment (NOA)

```
Canada Revenue   Agence du revenu
Agency           du Canada

  Notice of assessment / Avis de cotisation
  Tax year / Année d'imposition: 2024

  HARJINDER SINGH GILL
  19 Maple Crescent
  Brampton ON  L6Y 1N2

  Social insurance number:  805 123 456
  Date issued / Date d'émission:  May 12, 2025
  Tax centre:  Sudbury Tax Centre

  Account summary
  We assessed your 2024 income tax and benefit return and calculated your balance.
    Refund:  $1,342.67   CR
  Your refund of $1,342.67 will be deposited to the account ending in 4471.

  Tax assessment
  Line 15000  Total income ......................   71,250.00
  Line 23600  Net income ........................   68,910.00
  Line 26000  Taxable income ....................   68,910.00
  Line 43500  Total payable .....................   12,118.40
  Line 43700  Total income tax deducted .........   13,461.07
  Line 48400  Refund ............................    1,342.67

  RRSP deduction limit for 2025:  $14,820
  Available contribution room:    $9,310

  Access code (for telephone service):  Q7K-LM2
```

<!-- GROUND_TRUTH
names: Harjinder Singh Gill
sins: 805 123 456
business_numbers: (none)
bank_account_fragments: account ending in 4471
postal_codes: L6Y 1N2
phones: (none)
emails: (none)
addresses: 19 Maple Crescent, Brampton ON L6Y 1N2
access_codes: Q7K-LM2
health_numbers: (none)
dates_to_KEEP_or_redact_per_policy: May 12, 2025 (date issued)
amounts_to_KEEP: 1342.67, 71250.00, 68910.00, 12118.40, 13461.07, 14820, 9310
-->

---

### SAMPLE: RC59 Business Consent / Engagement letter excerpt (tricky free-text PII)

```
Engagement Letter – Personal Tax Preparation 2025
Prepared by: Lakeshore Accounting Group

Re: Tax preparation services for William & Sandra Nguyen

Dear Mr. and Mrs. Nguyen,

This letter confirms our engagement to prepare the 2025 T1 returns for both
William Nguyen (SIN 130-692-549) and his spouse Sandra Nguyen (SIN 130 692 550).
Your daughter, Emily Nguyen (born 2009-07-22), will be claimed as a dependant.

Please confirm your current mailing address remains 42 Lakeshore Road East,
Oakville ON L6J 1H4, and that the best contact number is 905-555-0123 or
cell 437-555-0190. We will send the draft return to wnguyen73@example.com.

Our firm's GST/HST number is 100200300 RT 0001; invoices total $640.00 plus
$83.20 HST for a total of $723.20.

Sincerely,
Priya Ramaswamy, CPA, CGA
Lakeshore Accounting Group | 200-1 City Centre Drive, Mississauga ON L5B 1M2
Office: (905) 555-0150  |  priya@lakeshoreaccounting.ca
```

<!-- GROUND_TRUTH
names: William Nguyen, Sandra Nguyen, Emily Nguyen, Priya Ramaswamy
firm_names: Lakeshore Accounting Group
sins: 130-692-549, 130 692 550
business_numbers: 100200300 RT 0001 (100200300RT0001)
dates_of_birth: 2009-07-22
postal_codes: L6J 1H4, L5B 1M2
phones: 905-555-0123, 437-555-0190, (905) 555-0150
emails: wnguyen73@example.com, priya@lakeshoreaccounting.ca
addresses: 42 Lakeshore Road East, Oakville ON L6J 1H4; 200-1 City Centre Drive, Mississauga ON L5B 1M2
health_numbers: (none)
amounts_to_KEEP: 640.00, 83.20, 723.20
-->

---

### SAMPLE: T5018 Statement of Contract Payments (table with SIN/BN inside cells)

```
Canada Revenue  Agence du revenu          Protected B when completed
Agency          du Canada

  T5018  Statement of Contract Payments / État des paiements contractuels   2025

  Payer:  HALLMARK CONSTRUCTION GROUP INC.   BN: 556677889 RC 0001

  Subcontractor details (one row per recipient)
  +-----+----------------------------+---------------------+---------------+
  | No. | Recipient name             | SIN or BN           | Box 22 Amount |
  +-----+----------------------------+---------------------+---------------+
  |  1  | Frank DeLuca               | 130 692 551         |    44,800.00  |
  |  2  | NORDIC DRYWALL LTD.         | 778899001 RC 0001   |   128,300.00  |
  |  3  | Geneviève Bélanger         | 130-692-552         |    19,940.00  |
  |  4  | 11223344 Canada Inc.       | 660055441 RT 0001   |    73,250.00  |
  +-----+----------------------------+---------------------+---------------+

  Total contract payments reported: 266,290.00
```

<!-- GROUND_TRUTH
names: Frank DeLuca, Geneviève Bélanger
payer_names: Hallmark Construction Group Inc.
recipient_business_names: Nordic Drywall Ltd., 11223344 Canada Inc.
sins: 130 692 551 (row 1, in table cell), 130-692-552 (row 3, in table cell)
business_numbers: 556677889 RC 0001 (556677889RC0001), 778899001 RC 0001 (778899001RC0001), 660055441 RT 0001 (660055441RT0001)
postal_codes: (none)
phones: (none)
emails: (none)
addresses: (none)
health_numbers: (none)
amounts_to_KEEP: 44800.00, 128300.00, 19940.00, 73250.00, 266290.00
-->

---

### SAMPLE: T2202 Tuition and Enrolment Certificate

```
Canada Revenue  Agence du revenu
Agency          du Canada

  T2202  Tuition and Enrolment Certificate
         Certificat pour frais de scolarité et d'inscription              2025

  Name of educational institution / Nom de l'établissement
  UNIVERSITY OF MANITOBA

  Student name / Nom de l'étudiant
  Chen, Wei-Ling

  Student number: 7741209
  Social insurance number / Numéro d'assurance sociale: 130692553

  Session periods and amounts
  +----------+----------+---------------+-------------------+
  | From     | To       | Box 24 months | Box 23 eligible $ |
  +----------+----------+---------------+-------------------+
  | 2025-01  | 2025-04  | PT: 0  FT: 4  |        4,212.00   |
  | 2025-09  | 2025-12  | PT: 0  FT: 4  |        4,212.00   |
  +----------+----------+---------------+-------------------+
  Box 23 total eligible tuition fees: 8,424.00
```

<!-- GROUND_TRUTH
names: Wei-Ling Chen
institution_names: University of Manitoba
student_numbers: 7741209
sins: 130692553
business_numbers: (none)
postal_codes: (none)
phones: (none)
emails: (none)
addresses: (none)
health_numbers: (none)
dates_to_KEEP_per_policy: 2025-01, 2025-04, 2025-09, 2025-12 (session periods)
amounts_to_KEEP: 4212.00, 8424.00
-->

---

### SAMPLE: RC62 Universal Child Care / mixed-PII slip with health number (edge case)

```
Canada Revenue  Agence du revenu
Agency          du Canada

  Statement of benefits – Relevé des prestations                          2025

  Recipient: Olivia Fortin-Lévesque
  Address:   5e étage, 1010 Rue de la Gauchetière Ouest
             Montréal QC  H3B 2N2
  SIN:       130 692 554

  Health card (Quebec RAMQ) on file: FORO 9012 3456 78
  Ontario health card (prior address): 1234-567-890-AB
  Personal Health Number (MB): 123456789

  Benefit amount paid (Box 10): 7,200.00
  Repayment required (Box 12):    480.00
```

<!-- GROUND_TRUTH
names: Olivia Fortin-Lévesque
sins: 130 692 554
business_numbers: (none)
postal_codes: H3B 2N2
phones: (none)
emails: (none)
addresses: 5e étage, 1010 Rue de la Gauchetière Ouest, Montréal QC H3B 2N2
health_numbers: FORO 9012 3456 78 (RAMQ Quebec), 1234-567-890-AB (Ontario OHIP), 123456789 (Manitoba PHN)
amounts_to_KEEP: 7200.00, 480.00
-->

---

## Summary of samples in this corpus

1. T4 — Statement of Remuneration Paid (RP business number, accented address)
2. T4A — Pension/Other Income (accented name Geneviève Bélanger, RZ account)
3. T5 — Investment Income (SIN unformatted, investment account number)
4. T3 — Trust Income (trust account number, two names incl. deceased)
5. T1 General — identification page (SIN spaced out, email, phone, DOB, refund)
6. T2 — Corporation return (RC business number, contact name, two addresses)
7. GST34/GST62 — GST/HST return (RT business number, owner name, sole-prop)
8. Notice of Assessment — NOA (SIN, bank fragment, access code, refund)
9. RC59-style engagement letter — free-text with multiple SINs, emails, phones
10. T5018 — Contract Payments (SINs + BNs inside a table, mixed person/business rows)
11. T2202 — Tuition certificate (student number + SIN, hyphenated name)
12. RC62-style benefit slip — multi-jurisdiction HEALTH numbers (RAMQ/OHIP/MB)

12 samples total. Tricky cases covered: SIN in table cell (T5018, T2202),
French-accented names (Bélanger, Côté, Fortin-Lévesque, Lévesque), business numbers
in RC/RT/RP/RZ variants, SINs in three formats, bilingual labels, name in unusual
position (table cell / mid-sentence in engagement letter), provincial health numbers,
and amounts_to_KEEP on every record to test false-positive redaction of dollar values.
```
