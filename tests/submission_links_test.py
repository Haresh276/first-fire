"""Check submitted URLs in the published directory layout."""
import csv
from html.parser import HTMLParser
from pathlib import Path
import re
import unittest
from urllib.parse import unquote, urljoin, urlsplit

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / "dist"
ORIGIN = "https://first-fire-lunar-lab.vercel.app/"


class Document(HTMLParser):
    def __init__(self, path):
        super().__init__()
        self.links = []
        self.ids = set()
        self.feed(path.read_text())

    def handle_starttag(self, tag, attributes):
        values = dict(attributes)
        if "id" in values:
            self.ids.add(values["id"])
        if tag == "a" and values.get("href"):
            self.links.append(values["href"])


class SubmissionLinks(unittest.TestCase):
    def test_public_submission_links_and_static_anchors(self):
        markdown = (ROOT / "research/submission.md").read_text()
        groups = {
            "research/submission.md": re.findall(r"\]\(([^)\s]+)\)", markdown),
            "submission.html": Document(ROOT / "site/submission.html").links,
        }
        for source, links in groups.items():
            for link in links:
                with self.subTest(source=source, link=link):
                    url = urlsplit(urljoin(ORIGIN + source, link))
                    if url.hostname != urlsplit(ORIGIN).hostname:
                        continue
                    target = SITE / unquote(url.path).lstrip("/")
                    if target == SITE:
                        target = target / "index.html"
                    self.assertTrue(target.is_file(), f"Missing published target {target}")
                    if target.suffix == ".html" and target.name != "index.html" and url.fragment:
                        self.assertIn(url.fragment, Document(target).ids)

    def test_submission_exposes_every_verified_psi_table(self):
        with (ROOT / "site/flint/psi-pack-comparison.csv").open() as manifest:
            expected = {row["repository_path"] for row in csv.DictReader(manifest)}
        links = Document(ROOT / "site/submission.html").links
        self.assertEqual(expected, {url for url in links if url.startswith("data/raw/")})
        self.assertEqual(len({url for url in links if url.startswith("https://doi.org/")}), 15)
