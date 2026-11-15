// Values are for the named specimens. A missing property stays null.
(() => {
  const lunar='https://ntrs.nasa.gov/citations/20250002114';
  const saffire='https://ntrs.nasa.gov/citations/20170008805';
  const smoke='https://www.nist.gov/news-events/news/2018/05/nistnasa-study-shows-one-detector-doesnt-fit-all-smoke-spacecraft';
  const nist='https://nvlpubs.nist.gov/nistpubs/Legacy/TN/nbstechnicalnote1128.pdf';
  const rows=[
    ['sibal','SIBAL cotton–fiberglass','Composite fabric','Cotton can char. The glass weave retains the specimen geometry.','SIBAL',saffire],
    ['pmma','PMMA acrylic','Melting polymer','Softening changes the shape and exposure of a heated specimen.','pmma|acrylic',lunar],
    ['cotton','Cotton fabric','Charring fabric','Flaming and smouldering require separate endpoints.','cotton',lunar],
    ['p213','P213 tape','Glass and acrylic adhesive','Geometry and adhesive determine which part of the tape supplies fuel.','p[ -]?213',lunar],
    ['polycarbonate','Polycarbonate','High-temperature polymer','Radiative heat loss can influence near-limit burning.','polycarbonate',lunar],
    ['nomex','Nomex fabric and hook-and-loop','Aramid','The Saffire composite and the lunar-tested fastener are distinct specimens.','nomex',lunar],
    ['synergy','Synergy Pro Navy','FM² fabric','Four chamber atmospheres are planned for this particular material.','synergy','https://ntrs.nasa.gov/citations/20260001966'],
    ['kapton','Kapton','Polyimide','Overheating can produce smoke even while flame spread remains unmeasured.','kapton',smoke],
    ['teflon','Teflon','Fluoropolymer','The SAME measurements compare detector signal with an alarm threshold.','teflon',smoke],
    ['silicone','Silicone rubber','Elastomer','A strong detector signal for this smoke does not establish response to other smokes.','silicone',smoke],
    ['cellulose','Cellulose / paper','Charring solid','The cabin model uses dry cellulose and retains combustion water in the gas phase.','cellulose|paper',nist],
    ['polyethylene','Polyethylene','Melting polymer','The cabin model uses a CH₂ repeat unit and complete combustion.','polyethylene',nist]
  ];
  const margins={pmma:[['0.8 mm sheet',1.9,'Lower']],p213:[['Adhesive tape',1.4,'Lower']],cotton:[['Flaming',.82,'Lower'],['Smouldering',1.8,'Not stated']],polycarbonate:[['Polycarbonate',2.3,'Higher']],nomex:[['Nomex Velcro',.32,'Higher']]};
  const materials=rows.map(([id,name,family,behavior,pattern,source])=>({id,name,family,behavior,pattern,source,
    margin:margins[id]||[],heatMJkg:id==='cellulose'?15.2:id==='polyethylene'?43.4:null,
    oxygenKgKg:id==='cellulose'?6*31.998/162.141:id==='polyethylene'?1.5*31.998/14.027:null,
    density:({pmma:1190,nomex:1370,polycarbonate:1200})[id]||null,pyrolysisK:({pmma:618,nomex:750,polycarbonate:700})[id]||null}));
  // Digitized at 1500-pixel page width from JAXA slide 26. One pixel array per panel
  // avoids importing an illustration or inventing precision beyond the source markers.
  const charts={
    pmma:{title:'Thin PMMA',x0:162,xDecade:225.3,baseline:977,o2base:10,pxPerPct:29.93,
      sustained:[[302,752],[337,698],[335,770],[332,788],[337,813],[337,830],[388,683],[387,755],[388,793],[388,809],[383,827],[453,737],[444,794],[446,810],[445,823]],
      extinct:[[230,744],[230,758],[230,797],[230,807],[303,770],[303,782],[337,846],[337,851],[388,850],[455,843],[455,851]],
      curve:[[267,469],[282,662],[302,751],[321,808],[338,829],[360,835],[388,836],[421,825],[447,811],[480,789],[510,766],[550,728],[590,684],[630,626],[668,548]]},
    nomex:{title:'Nomex HT90-40',x0:919,xDecade:222.3,baseline:935,o2base:26,pxPerPct:38.65,
      sustained:[[1092,715],[1092,760],[1141,721],[1141,779],[1141,799],[1208,670],[1208,740],[1208,779],[1208,799]],
      extinct:[[986,721],[986,741],[986,789],[986,827],[986,900],[1092,788],[1092,804],[1092,823],[1092,900],[1141,741],[1141,804],[1141,823],[1141,900]],
      curve:[[1074,472],[1082,631],[1092,715],[1106,761],[1124,790],[1141,800],[1156,802],[1180,797],[1208,782],[1236,760],[1263,735],[1290,707],[1320,673],[1350,634],[1380,594],[1420,534]]}
  };
  const dataset={materials,charts,
    icesFigureNote:"ICES-2025-392 Fig. 13 and the single-material figures disagree on some lunar limits. FLINT uses Fig. 13 and checks the alternate readings.",
    flowSource:'https://iss.jaxa.jp/kiboexp/news/images/2018ams_flare.pdf#page=26',
    reference:'https://www.jstage.jst.go.jp/article/tastj/16/1/16_28/_article',
    lunar,atmosSource:'https://ntrs.nasa.gov/citations/20240003211'};
  if(typeof module!=='undefined')module.exports=dataset;
  if(typeof window!=='undefined')window.FFMaterialData=dataset;
})();
