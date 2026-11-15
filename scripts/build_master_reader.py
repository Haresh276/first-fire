"""Produce a cited learning edition from the team's 101-page source; pass the original PDF path."""
import argparse, hashlib, io
from pathlib import Path
from pypdf import PdfReader, PdfWriter
from reportlab.pdfgen.canvas import Canvas
from reportlab.lib.colors import HexColor
from reportlab.lib.pagesizes import A4
ROOT=Path(__file__).resolve().parents[1]
def build(src,out):
    sha=hashlib.sha256(src.read_bytes()).hexdigest()
    original=PdfReader(src)
    if len(original.pages)!=101 or 'Master Document' not in str(original.metadata.title):
        raise ValueError('Use the FIRST FIRE Master Document 1.0 (interim), 101 pages.')
    writer=PdfWriter(); tmp=io.BytesIO(); c=Canvas(tmp,pagesize=A4)
    c.setFillColor(HexColor('#193e36'));c.rect(0,0,A4[0],A4[1],fill=1,stroke=0);c.setFillColor(HexColor('#fffbed'))
    c.setFont('Helvetica-Bold',29);c.drawString(44,721,'FIRST FIRE');c.drawString(44,677,'Science field guide')
    c.setFont('Helvetica',12);y=622
    for line in ['Team Code Blooded  /  Master Document 1.0, interim edition','',
                 'This reader preserves the original teaching pages and their printed page numbers.',
                 'Open a bookmark to jump to a chapter. The release notes below update the text.','',
                 'Pages 15-38   Combustion, gravity, life support, FM2 and data engineering',
                 'Pages 96-101  Glossary, misconceptions, seal check and original build map',
                 'Pages 89-95   Full source register and checked claims from the original master','',
                 'When the guide refers to zero lunar or Martian tests, read this as zero',
                 'surface-flight observations at those gravities in the bundled PSI archive.',
                 'Earth facilities have produced partial-gravity experiments. Olson and Ferkul',
                 'report three materials at Mars-like acceleration in a drop-tower centrifuge',
                 '(NASA NTRS 20130010991, Table I). It was a short-duration test on Earth.','',
                 'Use the live benchmark for updated chat scores, and the model pages for',
                 'the validation status of this release. Forecasts refer to the fixed team record.','',
                 'Current instruments and source links: open the Field guide on the dashboard.']:
        c.drawString(44,y,line);y-=18
    c.setFont('Courier',8);c.drawString(44,90,'Source SHA-256');c.drawString(44,75,sha);c.showPage();c.save();tmp.seek(0)
    writer.add_page(PdfReader(tmp).pages[0]);writer.add_outline_item('About this edition',0)
    ranges=list(range(15,39))+list(range(96,102))+list(range(89,96))
    for n in ranges:writer.add_page(original.pages[n-1])
    for name,n in [('Combustion and gravity',16),('Atmospheres',19),('Experiments',21),('Ground facilities',25),('Forecast mathematics',26),('Data and software',28),('Evidence and citations',30),('Cabin physics',33),('Life support and materials',35),('Mars',37),('Glossary',96),('Common misconceptions',100),('Original proposal to implementation map',101),('Master bibliography and source-status key',89),('Partner and Earth sources',91),('Methods, tools and other teams',92),('Source corrections and claims',94)]:
        writer.add_outline_item(name,1+ranges.index(n))
    writer.add_metadata({'/Title':'FIRST FIRE Science Field Guide','/Author':'Team Code Blooded','/Subject':'Educational sections from Master Document 1.0, with release corrections'})
    with out.open('wb') as f:writer.write(f)
if __name__=='__main__':
    a=argparse.ArgumentParser(description=__doc__);a.add_argument('source',type=Path);a.add_argument('--output',type=Path,default=ROOT/'site'/'first-fire-field-guide.pdf')
    o=a.parse_args();build(o.source,o.output)
