# Canadian Business / Bookkeeping PII Redaction Test Corpus

Purpose: stress-test a Canadian PII redaction tool. All data below is FAKE / SAMPLE
data placed into realistic, accurately-formatted document layouts (labels and column
structures pulled from real Canadian templates: RBC eStatement, CRA Phoenix pay stub,
CPA Canada / CSRS 4200 compilation letters, ASPE illustrative statements, CIBC credit-card
statement, Canadian MICR cheque format).

Conventions used for the answer key:
- Canadian bank coordinates: transit = 5 digits, institution = 3 digits, account = 7-12 digits.
  Institution codes: RBC 003, BMO 001, Scotiabank 002, TD 004, CIBC 010.
- GST/HST registration number format: 9 digits + "RT" + 4-digit ref, e.g. 123456789RT0001.
- SIN format: 3-3-3 (e.g. 046 454 286). All SINs below are fake.
- Credit cards: Luhn-VALID test numbers must be CAUGHT; the Luhn-INVALID decoy must NOT
  be flagged as a card.

Each section has machine-readable GROUND_TRUTH in an HTML comment for auto-scoring.
`amounts_to_KEEP` lists dollar figures a human would NOT redact (they are business data,
not PII) — useful for false-positive scoring.

---

### SAMPLE: Canadian pay stub (bi-weekly, Ontario)

```
                          NORTHWIND LOGISTICS INC.
                    245 Front Street West, Toronto ON  M5J 2X9
                          Business Number: 845112309 RP0001

  EMPLOYEE STATEMENT OF EARNINGS                       Pay Period: 12
  -------------------------------------------------------------------------
  Employee:   Sarah O'Brien                     Pay Begin:   2026-05-25
  Employee #: 004821                            Pay End:     2026-06-07
  SIN:        046 454 286                        Cheque Date: 2026-06-12
  Address:    88 Wellesley St E, Apt 1402        Province of
              Toronto ON  M4Y 1H2                Employment:  ON

  EARNINGS              Rate      Hours      Current        YTD
  Regular              32.5000    75.00      2,437.50     29,250.00
  Overtime             48.7500     4.00        195.00      1,560.00
  Vacation Pay                                 145.50      1,746.00
                                            ----------   ----------
  Gross Earnings                             2,778.00     32,556.00

  DEDUCTIONS                                  Current        YTD
  Federal Tax                                  312.45      3,749.40
  Provincial Tax (ON)                          141.20      1,694.40
  CPP                                          158.45      1,901.40
  EI                                            45.28        543.36
  RRSP (employee)                              100.00      1,200.00
  Union Dues                                    27.50        330.00
                                            ----------   ----------
  Total Deductions                             784.88      9,418.96

  EMPLOYER CONTRIBUTIONS                      Current        YTD
  CPP (employer)                               158.45      1,901.40
  EI (employer 1.4x)                            63.39        760.70

  NET PAY                                    1,993.12
  Deposited to account ****4321 at institution 003 (RBC)
```

<!-- GROUND_TRUTH
names: Sarah O'Brien
sins: 046 454 286
employee_ids: 004821
business_numbers: 845112309 RP0001
bank_accounts: account ****4321 institution 003 (masked deposit account)
credit_cards: (none)
postal_codes: M5J 2X9, M4Y 1H2
phones: (none)
emails: (none)
addresses: 245 Front Street West Toronto ON; 88 Wellesley St E Apt 1402 Toronto ON
dates: 2026-05-25, 2026-06-07, 2026-06-12
amounts_to_KEEP: 32.5000, 2437.50, 195.00, 145.50, 2778.00, 312.45, 141.20, 158.45, 45.28, 100.00, 27.50, 784.88, 63.39, 1993.12, 29250.00, 32556.00, 9418.96
tricky: "Pay Period: 12" is NOT a SIN/account; "Employee #: 004821" is an ID not a phone; RP0001 is a payroll BN program account (still a business number)
-->

---

### SAMPLE: Quebec pay stub with accented name and QPP/QPIP (Phoenix-style federal layout)

```
  GOVERNMENT OF CANADA  /  GOUVERNEMENT DU CANADA
  Pay stub / Talon de paie

  Name / Nom:            Jean-Pierre Gagné
  PRI / CIDP:            123456789
  Department / Ministère: Service Canada
  Pay period / Période de paie: 2026-05-21 to 2026-06-03

  Current ($)        Earnings / Gains              YTD ($)
  3,205.40           Regular pay / Paie régulière   38,464.80
    412.00           Bilingual bonus / Prime        4,944.00

  Current ($)        Deductions / Retenues          YTD ($)
    498.10           Federal tax / Impôt fédéral     5,977.20
    389.55           Quebec tax / Impôt du Québec    4,674.60
    201.45           QPP / RRQ                       2,417.40
     78.20           QPIP / RQAP                       938.40
     54.16           EI / AE                           649.92

  Net pay / Paie nette (this period): 2,295.78
  Mailing address: 1255, boul. René-Lévesque, Montréal QC  H3B 4W8
```

<!-- GROUND_TRUTH
names: Jean-Pierre Gagné
sins: (none) — note: PRI/CIDP 123456789 is a Personal Record Identifier, treat as a personal identifier to redact
personal_identifiers: PRI/CIDP 123456789
business_numbers: (none)
bank_accounts: (none)
credit_cards: (none)
postal_codes: H3B 4W8
phones: (none)
emails: (none)
addresses: 1255 boul René-Lévesque Montréal QC
dates: 2026-05-21, 2026-06-03
amounts_to_KEEP: 3205.40, 412.00, 38464.80, 4944.00, 498.10, 389.55, 201.45, 78.20, 54.16, 2295.78, 5977.20, 4674.60, 2417.40, 938.40, 649.92
tricky: accented name "Gagné" + hyphenated "Jean-Pierre"; PRI "123456789" is 9 digits like a BN-base but is a PERSON identifier here, not a business number
-->

---

### SAMPLE: RBC personal chequing account statement (transaction table)

```
  RBC Royal Bank                         Your personal chequing account
  ---------------------------------------------------------------------
  MARC TREMBLAY                          Statement period:
  1450 Rue Sainte-Catherine O            May 1, 2026 to May 31, 2026
  Montréal QC  H3G 1S5

  Your account number: 00123-003-4567891      Branch transit: 00123
                                              Institution: 003

  Opening Balance May 1                                     4,210.55

  Date     Description                  Withdrawals  Deposits   Balance
  May 02   Payroll Deposit NORTHWIND                 1,993.12   6,203.67
  May 04   e-Transfer to J. Lapointe       250.00               5,953.67
  May 09   HYDRO QUEBEC PAP                 142.88               5,810.79
  May 12   POS Purchase METRO #418           87.43               5,723.36
  May 15   Cheque #0243                     100.55               5,622.81
  May 20   INTERAC e-Transfer from
           sarah.obrien@example.ca                    500.00    6,122.81
  May 28   Monthly Account Fee                4.00               6,118.81

  Closing Balance May 31                                    6,118.81
```

<!-- GROUND_TRUTH
names: Marc Tremblay, J. Lapointe, Sarah O'Brien (from email)
sins: (none)
business_numbers: (none)
bank_accounts: account 00123-003-4567891; transit 00123; institution 003
credit_cards: (none)
postal_codes: H3G 1S5
phones: (none)
emails: sarah.obrien@example.ca
addresses: 1450 Rue Sainte-Catherine O Montréal QC
cheque_numbers: 0243
dates: May 1 2026, May 31 2026, May 02, May 04, May 09, May 12, May 15, May 20, May 28
amounts_to_KEEP: 4210.55, 1993.12, 250.00, 142.88, 87.43, 100.55, 500.00, 4.00, 6118.81, 6203.67, 5953.67, 5810.79, 5723.36, 5622.81, 6122.81
tricky: account number "00123-003-4567891" is in transit-institution-account composite form; "#418" (store number) and "Cheque #0243" are identifiers in a transaction table, not the account; balance column amounts must be KEPT
-->

---

### SAMPLE: Bank account in a columnar table (vendor banking details for EFT setup)

```
  PRE-AUTHORIZED DEBIT / EFT VENDOR SETUP FORM

  Vendor Name        Contact            Transit  Inst  Account       Amount
  -----------------------------------------------------------------------------
  Lakeshore Supply   Émilie Côté        21002    002   1234567       1,500.00
  O'Brien & Sons     Sarah O'Brien      00123    003   004567891     2,034.55
  Gagné Plomberie    Jean-Pierre Gagné  30007    010   88810099012     895.20

  Remit advice email: ap@lakeshoresupply.ca
  Authorized by: David Nguyen, Controller   Phone: 604-555-0142
```

<!-- GROUND_TRUTH
names: Émilie Côté, Sarah O'Brien, Jean-Pierre Gagné, David Nguyen
sins: (none)
business_numbers: (none)
bank_accounts: transit 21002 inst 002 account 1234567; transit 00123 inst 003 account 004567891; transit 30007 inst 010 account 88810099012
credit_cards: (none)
postal_codes: (none)
phones: 604-555-0142
emails: ap@lakeshoresupply.ca
addresses: (none)
amounts_to_KEEP: 1500.00, 2034.55, 895.20
tricky: bank account numbers sit inside a fixed-width TABLE next to a transit and an institution column; account "88810099012" (11 digits) and "004567891" (9 digits) are valid Canadian account lengths and must not be confused with a card; "1,500.00" in the Amount column is a dollar figure to KEEP, not an account number; accented "Côté" and "Gagné", apostrophe "O'Brien"
-->

---

### SAMPLE: Invoice with GST/HST registration number and line items

```
                              INVOICE
  Maple Ridge Consulting Inc.                  Invoice #: INV-2026-0417
  77 King Street West, Suite 700               Invoice Date: 2026-06-01
  Toronto ON  M5K 1A1                          Due Date: 2026-07-01
  GST/HST Reg. No.: 123456789RT0001            Terms: Net 30

  Bill To:
  Riverside Dental Group
  Attn: Dr. Priya Sharma
  1820 Bayview Avenue
  Toronto ON  M4G 3C9

  Description                              Qty   Unit Price      Amount
  -----------------------------------------------------------------------
  Bookkeeping services - May 2026          1      1,200.00     1,200.00
  Year-end planning consultation         3.5        185.00       647.50
  QuickBooks Online subscription           1         70.00        70.00
                                                  Subtotal:     1,917.50
                                              HST (13%):           249.28
                                                  TOTAL:        2,166.78

  Remit to: accounts@mapleridgeconsulting.ca  |  Tel: 416-555-0199
  EFT: transit 12345 institution 004 account 7654321 (TD)
```

<!-- GROUND_TRUTH
names: Priya Sharma
sins: (none)
business_numbers: 123456789RT0001
bank_accounts: transit 12345 institution 004 account 7654321
credit_cards: (none)
postal_codes: M5K 1A1, M4G 3C9
phones: 416-555-0199
emails: accounts@mapleridgeconsulting.ca
addresses: 77 King Street West Suite 700 Toronto ON; 1820 Bayview Avenue Toronto ON
dates: 2026-06-01, 2026-07-01
amounts_to_KEEP: 1200.00, 185.00, 70.00, 1917.50, 249.28, 2166.78
tricky: "Invoice #: INV-2026-0417" is a document number, not PII; GST/HST number 123456789RT0001 is a business number; "3.5" qty and "13" (HST %) are not identifiers; bank account appears as labelled EFT triple
-->

---

### SAMPLE: Compilation engagement letter (CSRS 4200, Canada)

```
  Wong & Associates LLP, Chartered Professional Accountants
  500 - 1188 West Georgia Street, Vancouver BC  V6E 4A2
  Tel: 604-555-0188   Email: kwong@wongcpa.ca

  June 11, 2026

  Mr. David Nguyen
  Director, Coastline Renovations Ltd.
  3450 Kingsway, Burnaby BC  V5R 5L9

  Dear Mr. Nguyen:

  Re: Compilation Engagement for the year ended December 31, 2025

  You have requested that we prepare the financial information of Coastline
  Renovations Ltd. (Business Number 778451209RC0001) for the year ended
  December 31, 2025, which comprise the balance sheet and the statement of
  income, on the basis of accounting disclosed in Note 1 to the financial
  information.

  This engagement is a compilation engagement performed in accordance with
  Canadian Standard on Related Services (CSRS) 4200, Compilation Engagements.
  We will not perform an audit or a review engagement and, accordingly, will
  not express an assurance opinion or conclusion.

  Our fee for this engagement is estimated at $3,500 plus applicable GST/HST.

  Yours truly,

  Karen Wong, CPA, CA
  Partner, Wong & Associates LLP
```

<!-- GROUND_TRUTH
names: David Nguyen, Karen Wong
sins: (none)
business_numbers: 778451209RC0001
bank_accounts: (none)
credit_cards: (none)
postal_codes: V6E 4A2, V5R 5L9
phones: 604-555-0188
emails: kwong@wongcpa.ca
addresses: 500-1188 West Georgia Street Vancouver BC; 3450 Kingsway Burnaby BC
dates: June 11 2026, December 31 2025
amounts_to_KEEP: 3500
tricky: name appears in a SIGNATURE BLOCK ("Karen Wong, CPA, CA / Partner") and in salutation ("Dear Mr. Nguyen"); "RC0001" is a corporate-income-tax BN program account; firm name "Wong & Associates LLP" — the personal surname Wong is embedded in the firm name (judgment call); "Note 1" and "CSRS 4200" and "$3,500" are not PII
-->

---

### SAMPLE: Balance sheet (ASPE classified format)

```
  COASTLINE RENOVATIONS LTD.
  Balance Sheet
  As at December 31, 2025
  (Compiled - see Compilation Engagement Report)

                                              2025          2024
  ASSETS
  Current assets
    Cash                                    42,118       31,540
    Accounts receivable                     88,750       72,310
    Inventory                               55,200       49,880
    Prepaid expenses                         6,430        5,900
                                          --------     --------
                                           192,498      159,630
  Property and equipment (net)             310,540      298,220
                                          --------     --------
  TOTAL ASSETS                             503,038      457,850

  LIABILITIES
  Current liabilities
    Accounts payable                        61,205       58,940
    Current portion of long-term debt       24,000       24,000
    GST/HST payable                          9,318        7,640
                                          --------     --------
                                            94,523       90,580
  Long-term debt                           145,000      169,000
                                          --------     --------
                                           239,523      259,580
  SHAREHOLDERS' EQUITY
    Share capital                              100          100
    Retained earnings                       263,415      198,170
                                          --------     --------
                                           263,515      198,270
  TOTAL LIABILITIES AND EQUITY             503,038      457,850

  Approved on behalf of the Board:
  _______________________  David Nguyen, Director
```

<!-- GROUND_TRUTH
names: David Nguyen
sins: (none)
business_numbers: (none)
bank_accounts: (none)
credit_cards: (none)
postal_codes: (none)
phones: (none)
emails: (none)
addresses: (none)
dates: December 31 2025, 2024
amounts_to_KEEP: 42118, 31540, 88750, 72310, 55200, 49880, 6430, 5900, 192498, 159630, 310540, 298220, 503038, 457850, 61205, 58940, 24000, 9318, 7640, 94523, 90580, 145000, 169000, 239523, 259580, 100, 263415, 198170, 263515, 198270
tricky: ENTIRE statement is financial figures that must be KEPT (false-positive trap); the only PII is the director's name in the approval signature line; "263415" looks like it could be an account number but is Retained earnings — must NOT be redacted
-->

---

### SAMPLE: Income statement with amount that looks like an account number

```
  COASTLINE RENOVATIONS LTD.
  Statement of Income
  For the year ended December 31, 2025

  Revenue                                            1,284,670
  Cost of goods sold                                   742,330
                                                    ----------
  Gross profit                                         542,340
  Operating expenses
    Salaries and wages                                 268,450
    Rent                                                48,000
    Office and administration                          7654321   <-- (figure typed without comma)
    Amortization                                        31,220
                                                    ----------
  Income before income taxes                            (?)
  Income taxes                                          18,940
                                                    ----------
  Net income                                           117,329

  Prepared by: Maple Ridge Consulting Inc., GST/HST 123456789RT0001
  Contact: accounts@mapleridgeconsulting.ca
```

<!-- GROUND_TRUTH
names: (none — corporate names only)
sins: (none)
business_numbers: 123456789RT0001
bank_accounts: (none) — IMPORTANT: "7654321" here is a DOLLAR FIGURE (Office and administration expense), NOT a bank account
credit_cards: (none)
postal_codes: (none)
phones: (none)
emails: accounts@mapleridgeconsulting.ca
addresses: (none)
dates: December 31 2025
amounts_to_KEEP: 1284670, 742330, 542340, 268450, 48000, 7654321, 31220, 18940, 117329
tricky: "7654321" is a 7-digit AMOUNT that exactly matches a plausible 7-digit account length — must NOT be flagged as a bank account (no transit/institution context, sits in an expense line); same digits appear as a real account in the invoice sample, so context is everything
-->

---

### SAMPLE: Credit-card statement (Luhn-VALID card — MUST be caught)

```
  CIBC Dividend Visa Infinite                 Statement period: May 6 - Jun 5, 2026
  ------------------------------------------------------------------------------
  SARAH O'BRIEN
  88 Wellesley St E, Apt 1402
  Toronto ON  M4Y 1H2

  Card number: 4111 1111 1111 1111
  Account number for payments: 5212 8841 0093

  Your account at a glance
    Previous balance                              812.40
    Payments and credits                         -812.40
    Total charges                                 1,043.27
    Total balance (New balance)                  1,043.27
    Credit limit                                 8,000.00
    Available credit                             6,956.73
    Minimum payment                                 25.00
    Payment due date                            June 26, 2026

  Trans   Post    Description                              Amount
  May 07  May 08  PRESTO FARE TORONTO                       12.00
  May 11  May 12  AMZN MKTP CA*2K4LP9                        58.99
  May 18  May 19  LOBLAWS 1455 TORONTO                      214.83
  May 22  May 23  ESSO CIRCLE K 6604                         71.45
  May 30  May 31  AIR CANADA 014 2198445567                 686.00

  Annual interest rate: 20.99% on purchases
```

<!-- GROUND_TRUTH
names: Sarah O'Brien
sins: (none)
business_numbers: (none)
bank_accounts: payment account 5212 8841 0093
credit_cards: 4111 1111 1111 1111  (Luhn-VALID, MUST be redacted)
postal_codes: M4Y 1H2
phones: (none)
emails: (none)
addresses: 88 Wellesley St E Apt 1402 Toronto ON
dates: May 6 2026, Jun 5 2026, June 26 2026
amounts_to_KEEP: 812.40, 1043.27, 8000.00, 6956.73, 25.00, 12.00, 58.99, 214.83, 71.45, 686.00, 20.99
tricky: "4111 1111 1111 1111" is a Luhn-VALID Visa test number and MUST be caught; "AIR CANADA 014 2198445567" contains a 10-digit ticket/booking number that is NOT a card and NOT a bank account; "ESSO CIRCLE K 6604" and "AMZN MKTP CA*2K4LP9" contain merchant identifiers, not PII; payment account "5212 8841 0093" is 12 digits in card-like grouping but is a bank payment account
-->

---

### SAMPLE: Multiple cards — one VALID, one INVALID decoy (Luhn discrimination test)

```
  PAYMENT RECONCILIATION SHEET — Aurora Boréale Café Ltée
  Prepared by: François Bélanger          Date: 2026-06-09

  Card on file (Mastercard):   5425 2334 3010 9903     [active]
  Old card (do not use):       4532 0151 1283 0367     [expired/typo on file]
  Amex corporate:              3782 822463 10005        [active]
  Order reference:             4532015112830999         [internal order ID, 16 digits]

  Settlement deposited to: transit 81020 institution 002 account 0098123456 (Scotiabank)
  Manager email: f.belanger@auroraboreale.ca   Cell: 514-555-0176
```

<!-- GROUND_TRUTH
names: François Bélanger
sins: (none)
business_numbers: (none)
bank_accounts: transit 81020 institution 002 account 0098123456
credit_cards: 5425 2334 3010 9903 (Luhn-VALID Mastercard, CATCH); 3782 822463 10005 (Luhn-VALID Amex 15-digit, CATCH)
credit_cards_DECOY_must_NOT_flag: 4532 0151 1283 0367 (Luhn-INVALID), 4532015112830999 (Luhn-INVALID internal order ID)
postal_codes: (none)
phones: 514-555-0176
emails: f.belanger@auroraboreale.ca
addresses: (none)
dates: 2026-06-09
amounts_to_KEEP: (none)
tricky: TWO card-shaped numbers fail Luhn (4532 0151 1283 0367 and 4532015112830999) and must NOT be flagged as cards; the Amex is 15 digits in 4-6-5 grouping (different shape) and IS valid; accented name "François Bélanger"
-->

---

### SAMPLE: MICR cheque line + void cheque (direct-deposit setup)

```
  ------------------------------ VOID ------------------------------
  MR. JOHN JONES                                         No. 0243
  1645 Dundas St W, Apt 27                          DATE 2026 06 11
  Toronto ON  M6K 1V2

  PAY TO THE ORDER OF  ___________________________  $ __________

  ________________________________________________________ DOLLARS

  FIRST BANK OF WIKI
  Victoria Main Branch
  1425 James St, P.O. Box 4001
  Victoria BC  V8X 3X4

  MEMO ____________________        ___________________________
                                   J. Jones (signature)

  MICR line:
  ⑆00005⑆123⑈ 123456789⑈ 0243

  (reads as)  transit 00005 | institution 123 | account 123456789 | cheque 0243
```

<!-- GROUND_TRUTH
names: John Jones, J. Jones
sins: (none)
business_numbers: (none)
bank_accounts: transit 00005 institution 123 account 123456789
credit_cards: (none)
postal_codes: M6K 1V2, V8X 3X4
phones: (none)
emails: (none)
addresses: 1645 Dundas St W Apt 27 Toronto ON; 1425 James St PO Box 4001 Victoria BC
cheque_numbers: 0243
dates: 2026 06 11
amounts_to_KEEP: (none)
tricky: MICR symbols ⑆ (transit) and ⑈ (on-us/account) wrap the digit groups and are parser-breaking; account number sits between MICR symbols; "No. 0243" cheque number repeats; signature-block name "J. Jones"; PO Box is part of an address
-->

---

### SAMPLE: T4-style slip excerpt with SIN and phone-vs-ID ambiguity

```
  T4  Statement of Remuneration Paid          Year: 2025
  -------------------------------------------------------------
  Employer: Northwind Logistics Inc.
  Employer account (BN): 845112309 RP0001

  Employee name (last, first): O'Brien, Sarah
  Social insurance number (Box 12): 046 454 286
  Employee phone on file:           416 555 0142
  Internal employee record locator: 4165550142998   (13-digit HR ID)

  Box 14  Employment income            32,556.00
  Box 16  Employee's CPP contributions  1,901.40
  Box 18  Employee's EI premiums          543.36
  Box 22  Income tax deducted           5,443.80
  Box 24  EI insurable earnings        32,556.00
  Box 26  CPP pensionable earnings      32,556.00
  Box 44  Union dues                       330.00
  Box 46  Charitable donations             250.00
```

<!-- GROUND_TRUTH
names: Sarah O'Brien
sins: 046 454 286
business_numbers: 845112309 RP0001
bank_accounts: (none)
credit_cards: (none)
postal_codes: (none)
phones: 416 555 0142
ids: 4165550142998 (13-digit HR record locator — personal identifier, redact)
emails: (none)
addresses: (none)
dates: 2025
amounts_to_KEEP: 32556.00, 1901.40, 543.36, 5443.80, 330.00, 250.00
tricky: phone "416 555 0142" (10 digits, space-grouped) sits one line above a 13-digit HR ID "4165550142998" that STARTS with the same digits — must distinguish a phone from a longer numeric ID; "Box 12", "Box 14" etc. are field labels, not PII; SIN "046 454 286" in 3-3-3; name in "last, first" order
-->

---

## CORPUS SUMMARY (answer-key rollup)

- 12 samples total.
- Luhn-VALID cards that MUST be caught: 4111 1111 1111 1111, 5425 2334 3010 9903, 3782 822463 10005 (Amex).
- Luhn-INVALID card-shaped strings that must NOT be flagged: 4532 0151 1283 0367, 4532015112830999.
- SINs (fake): 046 454 286 (appears twice).
- GST/HST business numbers: 123456789RT0001; BN program accounts 845112309RP0001 (payroll), 778451209RC0001 (corp tax).
- Bank-account-in-a-table cases: EFT vendor form + reconciliation sheet + invoice EFT footer.
- Amount-that-looks-like-an-account: "7654321" appears BOTH as a real account (invoice/EFT) AND as a dollar figure (income statement) — context discrimination test.
- Phone-vs-long-ID: 416 555 0142 (phone) vs 4165550142998 (13-digit HR ID).
- Apostrophe name: O'Brien. Hyphenated: Jean-Pierre. Accented: Gagné, Côté, François Bélanger, Émilie Côté, René-Lévesque.
- Signature-block names: Karen Wong (engagement letter), David Nguyen (balance sheet approval), J. Jones (cheque).
- MICR parser-breakers: ⑆ ⑈ symbols around transit/institution/account.
- False-positive traps: entire balance sheet + income statement are dollar figures to KEEP.
