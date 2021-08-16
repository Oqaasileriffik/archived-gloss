'use strict';

function esc_html(t) {
	return t.
		replace(/&/g, '&amp;').
		replace(/</g, '&lt;').
		replace(/>/g, '&gt;').
		replace(/"/g, '&quot;').
		replace(/'/g, '&apos;');
}

function dec_html(t) {
	return t.
		replace(/&lt;/g, '<').
		replace(/&gt;/g, '>').
		replace(/&quot;/g, '"').
		replace(/&apos;/g, "'").
		replace(/&amp;/g, '&');
}

// From https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Regular_Expressions
function esc_regex(t) {
	return t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function detect_format(t) {
	let f = 'plain';
	if (/(^|\n)"<[^\n\t]+>"/.test(t) && /(^|\n);?\t"[^\n\t]+"/.test(t)) {
		f = 'cg';
	}
	else if (/(^|\n)&quot;&lt;[^\n\t]+&gt;&quot;/.test(t) && /(^|\n);?\t&quot;[^\n\t]+&quot;/.test(t)) {
		f = 'cg';
	}
	else if (/\S+\t[^+\s]+\+[^+\s]+/.test(t)) {
		f = 'fst';
	}
	return f;
}

function to_plain(t, f) {
	if (!f) {
		f = detect_format(t);
	}

	let plain = '';
	if (f === 'fst') {
		let last = '';
		let lines = t.split("\n");
		for (let i=0 ; i<lines.length ; ++i) {
			let ws = /^(\S+)\t/.exec(lines[i]);
			if (ws && ws[1]) {
				if (ws[1] !== last) {
					plain += ws[1]+' ';
				}
				last = ws[1];
			}
		}
	}
	else if (f === 'cg') {
		let lines = t.split("\n");
		for (let i=0 ; i<lines.length ; ++i) {
			let w = /^"<(.*)>"/.exec(lines[i]);
			if (w) {
				plain += w[1]+' ';
			}
		}
	}
	else {
		plain = t;
	}

	return $.trim(plain);
}

function hilite_output(t, f) {
	if (!f || f === 'auto') {
		f = detect_format(t);
	}

	if (f === 'fst') {
		t = t.replace(/\t([^+\n]+)(?=\+|\n|$)/g, '\t<span class="c-fst-b">$1</span>');
		t = t.replace(/\+([^\/+\n]+)(?=\+|\n|$)/g, '+<span class="c-fst-p">$1</span>');
		t = t.replace(/\+([^\/+\n]+\/[^+\n]+)(?=\+|\n|$)/g, '+<span class="c-fst-s">$1</span>');
		t = t.replace(/\+/g, '<span class="c-fst-pl">+</span>');
	}
	else if (f === 'cg') {
		let ls = t.split("\n");
		for (let i=0 ; i<ls.length ; ++i) {
			let ln = ls[i];
			if (/^(;?\t)(&quot;\S*[^&]+\S*&quot;)/.test(ln)) {
				ln = ln.replace(/ /g, '\t');
				let b = /^(;?\t)(&quot;\S*[^&]+\S*&quot;)(.*)$/.exec(ln);

				b[3] = b[3].replace(/(\t)(&lt;[^\s:]*:[^&:]+[^\s:]*&gt;)(?=\t|\n|$)/g, '$1<span class="c-cg-sc">$2</span>');
				b[3] = b[3].replace(/(\t)(&lt;\S*[^&]+\S*&gt;)(?=\t|\n|$)/g, '$1<span class="c-cg-s">$2</span>');
				b[3] = b[3].replace(/(\t)([@§£][^\s]+)(?=\t|\n|$)/g, '$1<span class="c-cg-m">$2</span>');
				b[3] = b[3].replace(/(\t)([-A-Z]+:\d+\S*)(?=\t|\n|$)/g, '$1<span class="c-cg-t">$2</span>');
				b[3] = b[3].replace(/(\t)((?![&@])[^\/\s]+\/[^\s]+)(?=\t|\n|$)/g, '$1<span class="c-cg-ps">$2</span>');
				b[3] = b[3].replace(/(\t)((?![&@])[^\/\s]+)(?=\t|\n|$)/g, '$1<span class="c-cg-p">$2</span>');

				ln = b[1]+'<span class="c-cg-b">'+b[2]+'</span>'+b[3];
				ln = ln.replace(/\t/g, ' ').replace(' ', '\t');
			}
			ls[i] = ln;
		}
		t = ls.join("\n");
	}
	else if (f === 'transfer') {
		t = t.replace(/(\[[^\n]+?\] \.\.\. [^\n]+)/g, '<span class="c-t-t">$1</span>');
	}

	return t;
}

function ajax_fail(e) {
	console.log(e);
	if (e.hasOwnProperty('responseJSON')) {
		toast('<span class="text-danger">Error '+e.status+'</span>', e.responseJSON.error);
		return;
	}
	toast('<span class="text-danger">Error '+e.status+'</span>', e.responseText);
}

function post(data) {
	return $.post('callback', data).fail(ajax_fail);
}

function toast(title, body, delay) {
	let h = new Date().getHours();
	let m = new Date().getMinutes();
	let stamp = (h < 10 ? ('0'+h) : h)+':'+(m < 10 ? ('0'+m) : m);
	let id = 'toast-'+Date.now()+'-'+(''+Math.random()).replace(/[^\d]+/g, '');
	let html = '<div class="toast" id="'+id+'"><div class="toast-header"><strong class="mr-auto">'+title+'</strong> <small>'+stamp+'</small><button tabindex="-1" type="button" class="ml-2 mb-1 btn-close" data-bs-dismiss="toast" aria-label="Close"></button></div><div class="toast-body">'+body+'</div></div>';
	$('#toasts').append(html);
	id = '#'+id;
	$(id).on('hidden.bs.toast', function() { console.log('Toasted '+$(this).attr('id')); $(this).remove(); });
	if (delay) {
		$(id).toast({animation: false, delay: delay});
	}
	else {
		$(id).toast({animation: false, autohide: false});
	}
	$(id).toast('show');

	return id;
}

function dep2svg(where, cg) {
	let rx = /^(.+?)>"\n\s+(".+)(\n|$)/;
	let wx = /("[^"]+"\S*)/;
	let dx = / #(\d+)->(\d+)/;

	let height = 20;
	let svg = d3.select(where)
		.append('svg')
			.attr('width', 300)
			.attr('height', height)
		;
	svg.append('style').text('@import url(/static/svg.css);');
	svg.append('defs')
		.append('marker')
		.attr('id', 'arrowhead').attr('markerWidth', 10).attr('markerHeight', 7).attr('refX', 0).attr('refY', 3.5).attr('orient', 'auto')
		.append('polygon').attr('points', '0 0, 10 3.5, 0 7')
		;
	let arcs = svg.append('g').classed('arcs', true);
	let nodes = svg.append('g').classed('nodes', true).attr('transform', 'translate(0, 200)');

	let selves = {};
	let x = 20;
	let lines = cg.replace(/^"</, '').split(/\n"</);
	for (let i=0 ; i<lines.length ; ++i) {
		let m = lines[i].match(rx);
		if (!m) {
			console.log('Did not match: '+lines[i]);
			continue;
		}

		let g = nodes.append('g')
			.classed('word', true)
			;

		let rect = g.append('rect')
			.attr('x', x)
			.attr('y', 20)
			.attr('rx', 3)
			.attr('ry', 3)
			;

		let dep = m[2].match(dx);
		if (dep) {
			let ds = parseInt(dep[1]);
			let dp = parseInt(dep[2]);
			rect.classed('ds'+ds, true);
			rect.attr('data-ds', ds);
			rect.attr('data-dp', dp);
			selves[ds] = rect;
		}

		let txts = [];
		txts.push(g.append('text')
			.classed('wform', true)
			.text(m[1]));

		let ts = m[2];
		ts = ts.replace(/("[^"]+"\S*) /g, '\n$1\n');
		ts = ts.replace(/ (#\d+->\d+)/, '\n$1');
		ts = ts.replace(/ ([A-Z]{2,})/g, '\n$1');
		ts = ts.replace(/ (@)/, '\n$1');
		ts = $.trim(ts).split(/\n+/);
		for (let j=0 ; j<ts.length ; ++j) {
			let text = g.append('text')
				.text(ts[j])
				;
			if (wx.test(ts[j])) {
				text.classed('bform', true);
				text.text(ts[j].substring(1, ts[j].length - 1));
			}
			else if (/^#\d+->\d+$/.test(ts[j])) {
				text.classed('dep', true);
			}
			else {
				text.classed('tags', true);
			}
			if (!text.node()) {
				console.log('No text: '+ts[j]);
				continue;
			}
			txts.push(text);
		}

		let mw = 0;
		let mh = 0;
		for (let j=0 ; j<txts.length ; ++j) {
			if (!txts[j].node()) {
				console.log('No text 2: '+j);
				continue;
			}
			let bbox = txts[j].node().getBBox();
			mw = Math.max(mw, bbox.width);
			mh = Math.max(mh, bbox.height);
		}

		height = Math.max(height, txts.length*mh + txts.length*5 + 60);
		rect
			.attr('width', mw + 20)
			.attr('height', txts.length*mh + txts.length*5 + 20)
			;
		for (let j=0 ; j<txts.length ; ++j) {
			txts[j]
				.attr('x', x + 10 + mw/2)
				.attr('y', 20 + 10 + j*(mh+5))
				;
		}

		x += mw + 30;
	}

	let mh = 2;
	let ars = [];
	for (let i in selves) {
		let node = selves[i];
		let start = node.attr('x')*1 + node.attr('width')/2;
		let end = node.attr('x')*1 + node.attr('width')/2;

		let dp = node.attr('data-dp')*1;
		if (dp && selves.hasOwnProperty(dp)) {
			let ne = selves[dp];
			end = ne.attr('x')*1 + ne.attr('width')/2;
		}

		if (node.attr('data-ds') && !dp) {
			arcs.append('line')
				.classed('arc', true)
				.attr('x1', start)
				.attr('y1', 220)
				.attr('x2', start)
				.attr('y2', 20)
				.attr('marker-end', 'url(#arrowhead)')
				;
			continue;
		}
		if (start == end) {
			continue;
		}

		let m = ['M', start, 220, 'A',
			(start - end)/2, ',',
			(start - end)/mh, 0, 0, ',',
			start < end ? 1 : 0, end, ',', 220]
			.join(' ');

		let arc = arcs.append('path').classed('arc', true).attr('d', m).attr('data-mh', start - end).attr('data-dir', start < end ? 'right' : 'left');

		while (arc.node().getBBox().height > 180) {
			mh += 0.25;
			m = ['M', start, 220, 'A',
				(start - end)/2, ',',
				(start - end)/mh, 0, 0, ',',
				start < end ? 1 : 0, end, ',', 220]
				.join(' ');
			arc.attr('d', m);
		}
		ars.push(arc);
	}

	console.log(mh);
	for (let j=0 ; j<ars.length ; ++j) {
		let d = ars[j].attr('d');
		d = d.replace(/ , (\S+)/, ' , '+(ars[j].attr('data-mh')/mh));
		ars[j].attr('d', d);

		let len = ars[j].node().getTotalLength();
		let p = ars[j].node().getPointAtLength(len/2);
		p = arcs.append('polygon')
			.attr('transform', 'translate('+(p.x - 5)+', '+(p.y - 3.5)+')')
			;

		if (ars[j].attr('data-dir') == 'left') {
			p.attr('points', '0 3.5, 10 0, 10 7').classed('dir-left', true);
		}
		else {
			p.attr('points', '0 0, 10 3.5, 0 7').classed('dir-right', true);
		}
	}

	svg.attr('width', x + 10);
	svg.attr('height', height + 200);
}

function btn_gloss() {
	$('code,svg').html('');

	let t = $('#input').val();
	let tid = toast('Running kal2eng pipe', 'Launching kal2eng glossing pipe.<br>Check your terminal for progress.');
	post({a: 'gloss', t: t}).done(function(rv) { $(tid).toast('hide'); return cb_gloss(rv); });
	return false;
}

function cb_gloss(rv) {
	if (!rv.hasOwnProperty('output')) {
		toast('Run failed', '<b>Error</b>');
		return false;
	}

	$('#output').show();
	$('.collapse').addClass('show');

	for (let i=0 ; i<rv.output.length ; ++i) {
		let t = rv.output[i];
		$('#txt-'+i).find('code').text(t);
		$('#tree-'+i).find('span').text('');

		if (/ #\d+->\d+/.test(t)) {
			dep2svg('#svg-'+i, t);
		}
	}
	$('.collapse').removeClass('show');
	$('#tree-3').addClass('show');
}

$(function() {
	$('#output').hide();
	$('#btnGloss').click(btn_gloss);

	/*
	let out = '';
	let cg = $.trim($('#output').text()).replace(/\r\n/g, '\n').replace(/\r+/g, '');
	$('#output').text('');
	let ss = cg.split(/\n\n+/);
	for (let i=0 ; i<ss.length ; ++i) {
		let svg = dep2svg(ss[i]);
	}
	//*/
});
