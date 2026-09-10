const pptxgen = require('pptxgenjs');
const p = new pptxgen();
p.defineLayout({ name: 'W', width: 13.333, height: 7.5 });
p.layout = 'W';
const s = p.addSlide();
s.background = { color: 'FFFFFF' };

const NAVY='1E2761', DORABG='26313F', BORDER='CBD6E2', SUB='5A6B7B', ARROW='8A97A6',
      C1='2F5F8F', C2='2E8B8B', C3='C8892F', ITAL='7A8794';

// ── Title ──
s.addText('Measurable IT Regulatory Oversight Model',
  { x:0.4, y:0.2, w:12.53, h:0.5, fontFace:'Calibri', fontSize:30, bold:true, color:NAVY, align:'center', isTextBox:true, margin:0 });
s.addText('One engine, any regulation — DORA is just the first load',
  { x:0.4, y:0.72, w:12.53, h:0.32, fontFace:'Calibri', fontSize:13, color:SUB, align:'center', isTextBox:true, margin:0 });

// ── Exception callout (dashed, amber) ──
s.addShape(p.ShapeType.roundRect, { x:5.55, y:1.16, w:3.1, h:0.66, rectRadius:0.06,
  fill:{ color:'FBEEDA' }, line:{ color:C3, width:1.25, dashType:'dash' } });
s.addText([
  { text:'No control? → logged exception', options:{ fontSize:9, bold:true, color:'A56A1E', breakLine:true } },
  { text:'(PW · TW · EX) — disclosed, not hidden', options:{ fontSize:8.5, color:'A56A1E' } },
], { x:5.55, y:1.16, w:3.1, h:0.66, align:'center', valign:'middle', isTextBox:true, margin:0 });
s.addShape(p.ShapeType.line, { x:7.1, y:1.82, w:0, h:0.33, line:{ color:C3, width:1.25, dashType:'dash', endArrowType:'triangle' } });

// ── helper: a control box (pill + title + subtitle) ──
function box(x, y, w, h, pill, pillColor, title, sub) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius:0.07, fill:{ color:'FFFFFF' }, line:{ color:BORDER, width:1 } });
  s.addShape(p.ShapeType.roundRect, { x:x+0.15, y:y+0.16, w:1.18, h:0.28, rectRadius:0.06, fill:{ color:pillColor }, line:{ type:'none' } });
  s.addText(pill, { x:x+0.15, y:y+0.16, w:1.18, h:0.28, fontSize:8.5, bold:true, color:'FFFFFF', align:'center', valign:'middle', isTextBox:true, margin:0 });
  s.addText([
    { text:title, options:{ fontSize:14, bold:true, color:NAVY, breakLine:true, paraSpaceAfter:3 } },
    { text:sub, options:{ fontSize:9.5, color:SUB } },
  ], { x:x+0.15, y:y+0.5, w:w-0.3, h:h-0.6, valign:'top', isTextBox:true, margin:0 });
}
function outcome(x, y, w, h, tag, tagColor, title, titleColor, sub) {
  s.addShape(p.ShapeType.roundRect, { x, y, w, h, rectRadius:0.07, fill:{ color: tagColor==='2C5F2D'?'ECF3EC':'EAF2FB' }, line:{ color: tagColor==='2C5F2D'?'B7D0B0':'A9C7E8', width:1 } });
  s.addText([
    { text:tag, options:{ fontSize:8.5, bold:true, color:tagColor, charSpacing:1, breakLine:true, paraSpaceAfter:4 } },
    { text:title, options:{ fontSize:14, bold:true, color:titleColor, breakLine:true, paraSpaceAfter:3 } },
    { text:sub, options:{ fontSize:9.5, color:SUB } },
  ], { x:x+0.18, y:y+0.16, w:w-0.36, h:h-0.3, valign:'top', isTextBox:true, margin:0 });
}
function arrow(x, y, w, h, opt) {
  s.addShape(p.ShapeType.line, Object.assign({ x, y, w, h, line:{ color:ARROW, width:1.75, endArrowType:'triangle' } }, opt||{}));
}

// ── Compliance lane ──
// DORA
s.addShape(p.ShapeType.roundRect, { x:0.4, y:2.15, w:1.95, h:1.45, rectRadius:0.08, fill:{ color:DORABG }, line:{ type:'none' } });
s.addText([
  { text:'◇ ANY REGULATION', options:{ fontSize:8, color:'9FB3C8', charSpacing:1, breakLine:true, paraSpaceAfter:4 } },
  { text:'DORA', options:{ fontSize:26, bold:true, color:'FFFFFF', breakLine:true, paraSpaceAfter:2 } },
  { text:'loaded today', options:{ fontSize:10, color:'C6D3E0', breakLine:true, paraSpaceAfter:5 } },
  { text:'AI Act · GDPR · NIST · ISO →', options:{ fontSize:7.5, color:'8496A8' } },
], { x:0.55, y:2.25, w:1.7, h:1.3, valign:'top', isTextBox:true, margin:0 });

box(2.70, 2.15, 2.50, 1.45, 'Control 1', C1, 'Coverage', 'DORA objectives covered by an owned policy / group-standard statement');
box(5.50, 2.15, 2.50, 1.45, 'Control 2', C2, 'Operationalisation', 'Owned statement operationalised by a referenced control (or exception)');
outcome(8.30, 2.15, 3.20, 1.45, 'OUTCOME · COMPLIANCE', C1, 'The DORA compliance risk', NAVY, 'complete set × implemented % → within board appetite');

arrow(2.35, 2.87, 0.35, 0);
arrow(5.20, 2.87, 0.30, 0);
arrow(8.00, 2.87, 0.30, 0);

// ── link into effectiveness lane ──
arrow(4.60, 3.60, 0, 0.60);
s.addText('controls enter the RCSA →', { x:4.85, y:3.68, w:3.2, h:0.28, fontSize:9, italic:true, color:ITAL, isTextBox:true, margin:0 });

// ── Effectiveness lane ──
box(2.70, 4.20, 3.70, 1.35, 'Control 3', C3, 'Effectiveness', 'Control efficacy in treating risk — controls mapped to ICT risks · tested in the RCSA · residual tracked');
outcome(8.30, 4.20, 3.20, 1.35, 'OUTCOME · EFFECTIVENESS', '2C5F2D', 'Operational resilience', '234A24', 'controls proven to reduce ICT risk (Appendix 5)');
arrow(6.40, 4.87, 1.90, 0);

// ── Re-run loop (dashed) ──
s.addShape(p.ShapeType.line, { x:1.15, y:5.92, w:10.35, h:0, line:{ color:ARROW, width:1.25, dashType:'dash' } });
s.addShape(p.ShapeType.line, { x:1.15, y:3.60, w:0, h:2.32, line:{ color:ARROW, width:1.25, dashType:'dash', beginArrowType:'triangle' } });
s.addText('Re-run the engine — annually + on material change',
  { x:3.5, y:5.58, w:6.3, h:0.3, fontSize:9.5, italic:true, color:ITAL, align:'center', isTextBox:true, margin:0 });

// ── Footer ──
s.addText([
  { text:'Controls 1 & 2 ', options:{ color:'2A3644' } },
  { text:'prove compliance', options:{ bold:true, color:C1 } },
  { text:'; Control 3 proves ', options:{ color:'2A3644' } },
  { text:'effectiveness', options:{ bold:true, color:'2C5F2D' } },
  { text:' through business-as-usual risk treatment.', options:{ color:'2A3644' } },
], { x:0.5, y:6.28, w:12.33, h:0.34, fontSize:12.5, align:'center', isTextBox:true, margin:0 });
s.addText('Swap the regulation; the engine — and the evidence — stay the same.',
  { x:0.5, y:6.68, w:12.33, h:0.32, fontSize:11, italic:true, color:SUB, align:'center', isTextBox:true, margin:0 });

p.writeFile({ fileName: 'Regulatory-Oversight-Model-diagram.pptx' }).then(f => console.log('WROTE', f));
