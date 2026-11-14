# Quotation receipts

Ten quotations in the seven case records have an individual page or HTML-section anchor in `pages.json`. Seven publisher originals are represented. The receipts contain a SHA-256 of the complete original byte stream and hashes of the ordered, normalized tokens from the whole cited page or section. They were produced by extracting text from the actual NASA, University of Maryland or PMC publications independently of the case text. Order, case, punctuation and numerals matter. The only normalization is Unicode NFKC, soft-hyphen removal and whitespace tokenization. PDF page numbers are viewer positions starting at one. SAME uses the publisher manuscript’s stable HTML section S8.

From the project root:

```sh
python3 scripts/verify_quotes.py
python3 scripts/verify_quotes.py --query saff25 'Despite this significant heating load, the fabric was not ignited.'
python3 scripts/verify_quotes.py --fetch
python3 scripts/verify_quotes.py --originals /path/to/pinned/publisher-files
```

The default verifier needs only Python’s standard library. The last two modes also need pypdf 6.10.0 for exact reproduction of tokenization from PDFs. The fetch option performs read-only HTTPS requests. It needs network access and a successful publisher response, and does not save originals. To use local copies, the required file names, URLs and full SHA-256 values are in `pages.json`. If a publisher replaces a file, the strict check reports a mismatch; check the revision before adopting a new receipt. Live PMC HTML can change banners or markup even when section S8 remains unchanged.

Offline lookup verifies the quote against the pinned page fingerprint. A strict run against all seven downloaded originals reproduced every page/section and file digest. Four deliberately changed or misattributed quotations were rejected. An exact text match confirms where words appeared. The surrounding argument, causal scope and future applicability need a reader’s judgment.

External papers, photographs, figures and publisher layouts retain their original rights. The project distributes short quotations with attribution and non-reconstructive document fingerprints rather than republishing complete PDFs. Individual word hashes are dictionary-testable; the receipts are integrity information, not a confidentiality mechanism. NASA records sometimes include third-party authors and figures. Public accessibility does not establish a common licence across sources. Keep source attribution and inspect a publication's own rights notice before reusing other material.
