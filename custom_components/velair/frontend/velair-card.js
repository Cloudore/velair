//#region \0rolldown/runtime.js
var e = Object.defineProperty, t = (t, n) => {
	let r = {};
	for (var i in t) e(r, i, {
		get: t[i],
		enumerable: !0
	});
	return n || e(r, Symbol.toStringTag, { value: "Module" }), r;
}, n = "20260715211831", r = "1.2.0", i = globalThis, a = i.ShadowRoot && (i.ShadyCSS === void 0 || i.ShadyCSS.nativeShadow) && "adoptedStyleSheets" in Document.prototype && "replace" in CSSStyleSheet.prototype, o = Symbol(), s = /* @__PURE__ */ new WeakMap(), c = class {
	constructor(e, t, n) {
		if (this._$cssResult$ = !0, n !== o) throw Error("CSSResult is not constructable. Use `unsafeCSS` or `css` instead.");
		this.cssText = e, this.t = t;
	}
	get styleSheet() {
		let e = this.o, t = this.t;
		if (a && e === void 0) {
			let n = t !== void 0 && t.length === 1;
			n && (e = s.get(t)), e === void 0 && ((this.o = e = new CSSStyleSheet()).replaceSync(this.cssText), n && s.set(t, e));
		}
		return e;
	}
	toString() {
		return this.cssText;
	}
}, l = (e) => new c(typeof e == "string" ? e : e + "", void 0, o), u = (e, ...t) => new c(e.length === 1 ? e[0] : t.reduce((t, n, r) => t + ((e) => {
	if (!0 === e._$cssResult$) return e.cssText;
	if (typeof e == "number") return e;
	throw Error("Value passed to 'css' function must be a 'css' function result: " + e + ". Use 'unsafeCSS' to pass non-literal values, but take care to ensure page security.");
})(n) + e[r + 1], e[0]), e, o), d = (e, t) => {
	if (a) e.adoptedStyleSheets = t.map((e) => e instanceof CSSStyleSheet ? e : e.styleSheet);
	else for (let n of t) {
		let t = document.createElement("style"), r = i.litNonce;
		r !== void 0 && t.setAttribute("nonce", r), t.textContent = n.cssText, e.appendChild(t);
	}
}, f = a ? (e) => e : (e) => e instanceof CSSStyleSheet ? ((e) => {
	let t = "";
	for (let n of e.cssRules) t += n.cssText;
	return l(t);
})(e) : e, { is: p, defineProperty: ee, getOwnPropertyDescriptor: te, getOwnPropertyNames: ne, getOwnPropertySymbols: re, getPrototypeOf: ie } = Object, ae = globalThis, m = ae.trustedTypes, h = m ? m.emptyScript : "", oe = ae.reactiveElementPolyfillSupport, g = (e, t) => e, se = {
	toAttribute(e, t) {
		switch (t) {
			case Boolean:
				e = e ? h : null;
				break;
			case Object:
			case Array: e = e == null ? e : JSON.stringify(e);
		}
		return e;
	},
	fromAttribute(e, t) {
		let n = e;
		switch (t) {
			case Boolean:
				n = e !== null;
				break;
			case Number:
				n = e === null ? null : Number(e);
				break;
			case Object:
			case Array: try {
				n = JSON.parse(e);
			} catch {
				n = null;
			}
		}
		return n;
	}
}, ce = (e, t) => !p(e, t), le = {
	attribute: !0,
	type: String,
	converter: se,
	reflect: !1,
	useDefault: !1,
	hasChanged: ce
};
Symbol.metadata ??= Symbol("metadata"), ae.litPropertyMetadata ??= /* @__PURE__ */ new WeakMap();
var _ = class extends HTMLElement {
	static addInitializer(e) {
		this._$Ei(), (this.l ??= []).push(e);
	}
	static get observedAttributes() {
		return this.finalize(), this._$Eh && [...this._$Eh.keys()];
	}
	static createProperty(e, t = le) {
		if (t.state && (t.attribute = !1), this._$Ei(), this.prototype.hasOwnProperty(e) && ((t = Object.create(t)).wrapped = !0), this.elementProperties.set(e, t), !t.noAccessor) {
			let n = Symbol(), r = this.getPropertyDescriptor(e, n, t);
			r !== void 0 && ee(this.prototype, e, r);
		}
	}
	static getPropertyDescriptor(e, t, n) {
		let { get: r, set: i } = te(this.prototype, e) ?? {
			get() {
				return this[t];
			},
			set(e) {
				this[t] = e;
			}
		};
		return {
			get: r,
			set(t) {
				let a = r?.call(this);
				i?.call(this, t), this.requestUpdate(e, a, n);
			},
			configurable: !0,
			enumerable: !0
		};
	}
	static getPropertyOptions(e) {
		return this.elementProperties.get(e) ?? le;
	}
	static _$Ei() {
		if (this.hasOwnProperty(g("elementProperties"))) return;
		let e = ie(this);
		e.finalize(), e.l !== void 0 && (this.l = [...e.l]), this.elementProperties = new Map(e.elementProperties);
	}
	static finalize() {
		if (this.hasOwnProperty(g("finalized"))) return;
		if (this.finalized = !0, this._$Ei(), this.hasOwnProperty(g("properties"))) {
			let e = this.properties, t = [...ne(e), ...re(e)];
			for (let n of t) this.createProperty(n, e[n]);
		}
		let e = this[Symbol.metadata];
		if (e !== null) {
			let t = litPropertyMetadata.get(e);
			if (t !== void 0) for (let [e, n] of t) this.elementProperties.set(e, n);
		}
		this._$Eh = /* @__PURE__ */ new Map();
		for (let [e, t] of this.elementProperties) {
			let n = this._$Eu(e, t);
			n !== void 0 && this._$Eh.set(n, e);
		}
		this.elementStyles = this.finalizeStyles(this.styles);
	}
	static finalizeStyles(e) {
		let t = [];
		if (Array.isArray(e)) {
			let n = new Set(e.flat(Infinity).reverse());
			for (let e of n) t.unshift(f(e));
		} else e !== void 0 && t.push(f(e));
		return t;
	}
	static _$Eu(e, t) {
		let n = t.attribute;
		return !1 === n ? void 0 : typeof n == "string" ? n : typeof e == "string" ? e.toLowerCase() : void 0;
	}
	constructor() {
		super(), this._$Ep = void 0, this.isUpdatePending = !1, this.hasUpdated = !1, this._$Em = null, this._$Ev();
	}
	_$Ev() {
		this._$ES = new Promise((e) => this.enableUpdating = e), this._$AL = /* @__PURE__ */ new Map(), this._$E_(), this.requestUpdate(), this.constructor.l?.forEach((e) => e(this));
	}
	addController(e) {
		(this._$EO ??= /* @__PURE__ */ new Set()).add(e), this.renderRoot !== void 0 && this.isConnected && e.hostConnected?.();
	}
	removeController(e) {
		this._$EO?.delete(e);
	}
	_$E_() {
		let e = /* @__PURE__ */ new Map(), t = this.constructor.elementProperties;
		for (let n of t.keys()) this.hasOwnProperty(n) && (e.set(n, this[n]), delete this[n]);
		e.size > 0 && (this._$Ep = e);
	}
	createRenderRoot() {
		let e = this.shadowRoot ?? this.attachShadow(this.constructor.shadowRootOptions);
		return d(e, this.constructor.elementStyles), e;
	}
	connectedCallback() {
		this.renderRoot ??= this.createRenderRoot(), this.enableUpdating(!0), this._$EO?.forEach((e) => e.hostConnected?.());
	}
	enableUpdating(e) {}
	disconnectedCallback() {
		this._$EO?.forEach((e) => e.hostDisconnected?.());
	}
	attributeChangedCallback(e, t, n) {
		this._$AK(e, n);
	}
	_$ET(e, t) {
		let n = this.constructor.elementProperties.get(e), r = this.constructor._$Eu(e, n);
		if (r !== void 0 && !0 === n.reflect) {
			let i = (n.converter?.toAttribute === void 0 ? se : n.converter).toAttribute(t, n.type);
			this._$Em = e, i == null ? this.removeAttribute(r) : this.setAttribute(r, i), this._$Em = null;
		}
	}
	_$AK(e, t) {
		let n = this.constructor, r = n._$Eh.get(e);
		if (r !== void 0 && this._$Em !== r) {
			let e = n.getPropertyOptions(r), i = typeof e.converter == "function" ? { fromAttribute: e.converter } : e.converter?.fromAttribute === void 0 ? se : e.converter;
			this._$Em = r;
			let a = i.fromAttribute(t, e.type);
			this[r] = a ?? this._$Ej?.get(r) ?? a, this._$Em = null;
		}
	}
	requestUpdate(e, t, n, r = !1, i) {
		if (e !== void 0) {
			let a = this.constructor;
			if (!1 === r && (i = this[e]), n ??= a.getPropertyOptions(e), !((n.hasChanged ?? ce)(i, t) || n.useDefault && n.reflect && i === this._$Ej?.get(e) && !this.hasAttribute(a._$Eu(e, n)))) return;
			this.C(e, t, n);
		}
		!1 === this.isUpdatePending && (this._$ES = this._$EP());
	}
	C(e, t, { useDefault: n, reflect: r, wrapped: i }, a) {
		n && !(this._$Ej ??= /* @__PURE__ */ new Map()).has(e) && (this._$Ej.set(e, a ?? t ?? this[e]), !0 !== i || a !== void 0) || (this._$AL.has(e) || (this.hasUpdated || n || (t = void 0), this._$AL.set(e, t)), !0 === r && this._$Em !== e && (this._$Eq ??= /* @__PURE__ */ new Set()).add(e));
	}
	async _$EP() {
		this.isUpdatePending = !0;
		try {
			await this._$ES;
		} catch (e) {
			Promise.reject(e);
		}
		let e = this.scheduleUpdate();
		return e != null && await e, !this.isUpdatePending;
	}
	scheduleUpdate() {
		return this.performUpdate();
	}
	performUpdate() {
		if (!this.isUpdatePending) return;
		if (!this.hasUpdated) {
			if (this.renderRoot ??= this.createRenderRoot(), this._$Ep) {
				for (let [e, t] of this._$Ep) this[e] = t;
				this._$Ep = void 0;
			}
			let e = this.constructor.elementProperties;
			if (e.size > 0) for (let [t, n] of e) {
				let { wrapped: e } = n, r = this[t];
				!0 !== e || this._$AL.has(t) || r === void 0 || this.C(t, void 0, n, r);
			}
		}
		let e = !1, t = this._$AL;
		try {
			e = this.shouldUpdate(t), e ? (this.willUpdate(t), this._$EO?.forEach((e) => e.hostUpdate?.()), this.update(t)) : this._$EM();
		} catch (t) {
			throw e = !1, this._$EM(), t;
		}
		e && this._$AE(t);
	}
	willUpdate(e) {}
	_$AE(e) {
		this._$EO?.forEach((e) => e.hostUpdated?.()), this.hasUpdated || (this.hasUpdated = !0, this.firstUpdated(e)), this.updated(e);
	}
	_$EM() {
		this._$AL = /* @__PURE__ */ new Map(), this.isUpdatePending = !1;
	}
	get updateComplete() {
		return this.getUpdateComplete();
	}
	getUpdateComplete() {
		return this._$ES;
	}
	shouldUpdate(e) {
		return !0;
	}
	update(e) {
		this._$Eq &&= this._$Eq.forEach((e) => this._$ET(e, this[e])), this._$EM();
	}
	updated(e) {}
	firstUpdated(e) {}
};
_.elementStyles = [], _.shadowRootOptions = { mode: "open" }, _[g("elementProperties")] = /* @__PURE__ */ new Map(), _[g("finalized")] = /* @__PURE__ */ new Map(), oe?.({ ReactiveElement: _ }), (ae.reactiveElementVersions ??= []).push("2.1.2");
//#endregion
//#region node_modules/lit-html/lit-html.js
var ue = globalThis, de = (e) => e, fe = ue.trustedTypes, pe = fe ? fe.createPolicy("lit-html", { createHTML: (e) => e }) : void 0, me = "$lit$", v = `lit$${Math.random().toFixed(9).slice(2)}$`, he = "?" + v, ge = `<${he}>`, y = document, _e = () => y.createComment(""), ve = (e) => e === null || typeof e != "object" && typeof e != "function", ye = Array.isArray, be = (e) => ye(e) || typeof e?.[Symbol.iterator] == "function", xe = "[ 	\n\f\r]", Se = /<(?:(!--|\/[^a-zA-Z])|(\/?[a-zA-Z][^>\s]*)|(\/?$))/g, Ce = /-->/g, we = />/g, b = RegExp(`>|${xe}(?:([^\\s"'>=/]+)(${xe}*=${xe}*(?:[^ \t\n\f\r"'\`<>=]|("|')|))|$)`, "g"), Te = /'/g, Ee = /"/g, De = /^(?:script|style|textarea|title)$/i, x = ((e) => (t, ...n) => ({
	_$litType$: e,
	strings: t,
	values: n
}))(1), S = Symbol.for("lit-noChange"), C = Symbol.for("lit-nothing"), Oe = /* @__PURE__ */ new WeakMap(), w = y.createTreeWalker(y, 129);
function ke(e, t) {
	if (!ye(e) || !e.hasOwnProperty("raw")) throw Error("invalid template strings array");
	return pe === void 0 ? t : pe.createHTML(t);
}
var Ae = (e, t) => {
	let n = e.length - 1, r = [], i, a = t === 2 ? "<svg>" : t === 3 ? "<math>" : "", o = Se;
	for (let t = 0; t < n; t++) {
		let n = e[t], s, c, l = -1, u = 0;
		for (; u < n.length && (o.lastIndex = u, c = o.exec(n), c !== null);) u = o.lastIndex, o === Se ? c[1] === "!--" ? o = Ce : c[1] === void 0 ? c[2] === void 0 ? c[3] !== void 0 && (o = b) : (De.test(c[2]) && (i = RegExp("</" + c[2], "g")), o = b) : o = we : o === b ? c[0] === ">" ? (o = i ?? Se, l = -1) : c[1] === void 0 ? l = -2 : (l = o.lastIndex - c[2].length, s = c[1], o = c[3] === void 0 ? b : c[3] === "\"" ? Ee : Te) : o === Ee || o === Te ? o = b : o === Ce || o === we ? o = Se : (o = b, i = void 0);
		let d = o === b && e[t + 1].startsWith("/>") ? " " : "";
		a += o === Se ? n + ge : l >= 0 ? (r.push(s), n.slice(0, l) + me + n.slice(l) + v + d) : n + v + (l === -2 ? t : d);
	}
	return [ke(e, a + (e[n] || "<?>") + (t === 2 ? "</svg>" : t === 3 ? "</math>" : "")), r];
}, je = class e {
	constructor({ strings: t, _$litType$: n }, r) {
		let i;
		this.parts = [];
		let a = 0, o = 0, s = t.length - 1, c = this.parts, [l, u] = Ae(t, n);
		if (this.el = e.createElement(l, r), w.currentNode = this.el.content, n === 2 || n === 3) {
			let e = this.el.content.firstChild;
			e.replaceWith(...e.childNodes);
		}
		for (; (i = w.nextNode()) !== null && c.length < s;) {
			if (i.nodeType === 1) {
				if (i.hasAttributes()) for (let e of i.getAttributeNames()) if (e.endsWith(me)) {
					let t = u[o++], n = i.getAttribute(e).split(v), r = /([.?@])?(.*)/.exec(t);
					c.push({
						type: 1,
						index: a,
						name: r[2],
						strings: n,
						ctor: r[1] === "." ? Fe : r[1] === "?" ? Ie : r[1] === "@" ? Le : Pe
					}), i.removeAttribute(e);
				} else e.startsWith(v) && (c.push({
					type: 6,
					index: a
				}), i.removeAttribute(e));
				if (De.test(i.tagName)) {
					let e = i.textContent.split(v), t = e.length - 1;
					if (t > 0) {
						i.textContent = fe ? fe.emptyScript : "";
						for (let n = 0; n < t; n++) i.append(e[n], _e()), w.nextNode(), c.push({
							type: 2,
							index: ++a
						});
						i.append(e[t], _e());
					}
				}
			} else if (i.nodeType === 8) if (i.data === he) c.push({
				type: 2,
				index: a
			});
			else {
				let e = -1;
				for (; (e = i.data.indexOf(v, e + 1)) !== -1;) c.push({
					type: 7,
					index: a
				}), e += v.length - 1;
			}
			a++;
		}
	}
	static createElement(e, t) {
		let n = y.createElement("template");
		return n.innerHTML = e, n;
	}
};
function T(e, t, n = e, r) {
	if (t === S) return t;
	let i = r === void 0 ? n._$Cl : n._$Co?.[r], a = ve(t) ? void 0 : t._$litDirective$;
	return i?.constructor !== a && (i?._$AO?.(!1), a === void 0 ? i = void 0 : (i = new a(e), i._$AT(e, n, r)), r === void 0 ? n._$Cl = i : (n._$Co ??= [])[r] = i), i !== void 0 && (t = T(e, i._$AS(e, t.values), i, r)), t;
}
var Me = class {
	constructor(e, t) {
		this._$AV = [], this._$AN = void 0, this._$AD = e, this._$AM = t;
	}
	get parentNode() {
		return this._$AM.parentNode;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	u(e) {
		let { el: { content: t }, parts: n } = this._$AD, r = (e?.creationScope ?? y).importNode(t, !0);
		w.currentNode = r;
		let i = w.nextNode(), a = 0, o = 0, s = n[0];
		for (; s !== void 0;) {
			if (a === s.index) {
				let t;
				s.type === 2 ? t = new Ne(i, i.nextSibling, this, e) : s.type === 1 ? t = new s.ctor(i, s.name, s.strings, this, e) : s.type === 6 && (t = new Re(i, this, e)), this._$AV.push(t), s = n[++o];
			}
			a !== s?.index && (i = w.nextNode(), a++);
		}
		return w.currentNode = y, r;
	}
	p(e) {
		let t = 0;
		for (let n of this._$AV) n !== void 0 && (n.strings === void 0 ? n._$AI(e[t]) : (n._$AI(e, n, t), t += n.strings.length - 2)), t++;
	}
}, Ne = class e {
	get _$AU() {
		return this._$AM?._$AU ?? this._$Cv;
	}
	constructor(e, t, n, r) {
		this.type = 2, this._$AH = C, this._$AN = void 0, this._$AA = e, this._$AB = t, this._$AM = n, this.options = r, this._$Cv = r?.isConnected ?? !0;
	}
	get parentNode() {
		let e = this._$AA.parentNode, t = this._$AM;
		return t !== void 0 && e?.nodeType === 11 && (e = t.parentNode), e;
	}
	get startNode() {
		return this._$AA;
	}
	get endNode() {
		return this._$AB;
	}
	_$AI(e, t = this) {
		e = T(this, e, t), ve(e) ? e === C || e == null || e === "" ? (this._$AH !== C && this._$AR(), this._$AH = C) : e !== this._$AH && e !== S && this._(e) : e._$litType$ === void 0 ? e.nodeType === void 0 ? be(e) ? this.k(e) : this._(e) : this.T(e) : this.$(e);
	}
	O(e) {
		return this._$AA.parentNode.insertBefore(e, this._$AB);
	}
	T(e) {
		this._$AH !== e && (this._$AR(), this._$AH = this.O(e));
	}
	_(e) {
		this._$AH !== C && ve(this._$AH) ? this._$AA.nextSibling.data = e : this.T(y.createTextNode(e)), this._$AH = e;
	}
	$(e) {
		let { values: t, _$litType$: n } = e, r = typeof n == "number" ? this._$AC(e) : (n.el === void 0 && (n.el = je.createElement(ke(n.h, n.h[0]), this.options)), n);
		if (this._$AH?._$AD === r) this._$AH.p(t);
		else {
			let e = new Me(r, this), n = e.u(this.options);
			e.p(t), this.T(n), this._$AH = e;
		}
	}
	_$AC(e) {
		let t = Oe.get(e.strings);
		return t === void 0 && Oe.set(e.strings, t = new je(e)), t;
	}
	k(t) {
		ye(this._$AH) || (this._$AH = [], this._$AR());
		let n = this._$AH, r, i = 0;
		for (let a of t) i === n.length ? n.push(r = new e(this.O(_e()), this.O(_e()), this, this.options)) : r = n[i], r._$AI(a), i++;
		i < n.length && (this._$AR(r && r._$AB.nextSibling, i), n.length = i);
	}
	_$AR(e = this._$AA.nextSibling, t) {
		for (this._$AP?.(!1, !0, t); e !== this._$AB;) {
			let t = de(e).nextSibling;
			de(e).remove(), e = t;
		}
	}
	setConnected(e) {
		this._$AM === void 0 && (this._$Cv = e, this._$AP?.(e));
	}
}, Pe = class {
	get tagName() {
		return this.element.tagName;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	constructor(e, t, n, r, i) {
		this.type = 1, this._$AH = C, this._$AN = void 0, this.element = e, this.name = t, this._$AM = r, this.options = i, n.length > 2 || n[0] !== "" || n[1] !== "" ? (this._$AH = Array(n.length - 1).fill(/* @__PURE__ */ new String()), this.strings = n) : this._$AH = C;
	}
	_$AI(e, t = this, n, r) {
		let i = this.strings, a = !1;
		if (i === void 0) e = T(this, e, t, 0), a = !ve(e) || e !== this._$AH && e !== S, a && (this._$AH = e);
		else {
			let r = e, o, s;
			for (e = i[0], o = 0; o < i.length - 1; o++) s = T(this, r[n + o], t, o), s === S && (s = this._$AH[o]), a ||= !ve(s) || s !== this._$AH[o], s === C ? e = C : e !== C && (e += (s ?? "") + i[o + 1]), this._$AH[o] = s;
		}
		a && !r && this.j(e);
	}
	j(e) {
		e === C ? this.element.removeAttribute(this.name) : this.element.setAttribute(this.name, e ?? "");
	}
}, Fe = class extends Pe {
	constructor() {
		super(...arguments), this.type = 3;
	}
	j(e) {
		this.element[this.name] = e === C ? void 0 : e;
	}
}, Ie = class extends Pe {
	constructor() {
		super(...arguments), this.type = 4;
	}
	j(e) {
		this.element.toggleAttribute(this.name, !!e && e !== C);
	}
}, Le = class extends Pe {
	constructor(e, t, n, r, i) {
		super(e, t, n, r, i), this.type = 5;
	}
	_$AI(e, t = this) {
		if ((e = T(this, e, t, 0) ?? C) === S) return;
		let n = this._$AH, r = e === C && n !== C || e.capture !== n.capture || e.once !== n.once || e.passive !== n.passive, i = e !== C && (n === C || r);
		r && this.element.removeEventListener(this.name, this, n), i && this.element.addEventListener(this.name, this, e), this._$AH = e;
	}
	handleEvent(e) {
		typeof this._$AH == "function" ? this._$AH.call(this.options?.host ?? this.element, e) : this._$AH.handleEvent(e);
	}
}, Re = class {
	constructor(e, t, n) {
		this.element = e, this.type = 6, this._$AN = void 0, this._$AM = t, this.options = n;
	}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AI(e) {
		T(this, e);
	}
}, ze = {
	M: me,
	P: v,
	A: he,
	C: 1,
	L: Ae,
	R: Me,
	D: be,
	V: T,
	I: Ne,
	H: Pe,
	N: Ie,
	U: Le,
	B: Fe,
	F: Re
}, Be = ue.litHtmlPolyfillSupport;
Be?.(je, Ne), (ue.litHtmlVersions ??= []).push("3.3.3");
var Ve = (e, t, n) => {
	let r = n?.renderBefore ?? t, i = r._$litPart$;
	if (i === void 0) {
		let e = n?.renderBefore ?? null;
		r._$litPart$ = i = new Ne(t.insertBefore(_e(), e), e, void 0, n ?? {});
	}
	return i._$AI(e), i;
}, He = globalThis, E = class extends _ {
	constructor() {
		super(...arguments), this.renderOptions = { host: this }, this._$Do = void 0;
	}
	createRenderRoot() {
		let e = super.createRenderRoot();
		return this.renderOptions.renderBefore ??= e.firstChild, e;
	}
	update(e) {
		let t = this.render();
		this.hasUpdated || (this.renderOptions.isConnected = this.isConnected), super.update(e), this._$Do = Ve(t, this.renderRoot, this.renderOptions);
	}
	connectedCallback() {
		super.connectedCallback(), this._$Do?.setConnected(!0);
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._$Do?.setConnected(!1);
	}
	render() {
		return S;
	}
};
E._$litElement$ = !0, E.finalized = !0, He.litElementHydrateSupport?.({ LitElement: E });
var Ue = He.litElementPolyfillSupport;
Ue?.({ LitElement: E }), (He.litElementVersions ??= []).push("4.2.2");
//#endregion
//#region node_modules/@lit/reactive-element/decorators/property.js
var We = {
	attribute: !0,
	type: String,
	converter: se,
	reflect: !1,
	hasChanged: ce
}, Ge = (e = We, t, n) => {
	let { kind: r, metadata: i } = n, a = globalThis.litPropertyMetadata.get(i);
	if (a === void 0 && globalThis.litPropertyMetadata.set(i, a = /* @__PURE__ */ new Map()), r === "setter" && ((e = Object.create(e)).wrapped = !0), a.set(n.name, e), r === "accessor") {
		let { name: r } = n;
		return {
			set(n) {
				let i = t.get.call(this);
				t.set.call(this, n), this.requestUpdate(r, i, e, !0, n);
			},
			init(t) {
				return t !== void 0 && this.C(r, void 0, e, t), t;
			}
		};
	}
	if (r === "setter") {
		let { name: r } = n;
		return function(n) {
			let i = this[r];
			t.call(this, n), this.requestUpdate(r, i, e, !0, n);
		};
	}
	throw Error("Unsupported decorator location: " + r);
};
function D(e) {
	return (t, n) => typeof n == "object" ? Ge(e, t, n) : ((e, t, n) => {
		let r = t.hasOwnProperty(n);
		return t.constructor.createProperty(n, e), r ? Object.getOwnPropertyDescriptor(t, n) : void 0;
	})(e, t, n);
}
//#endregion
//#region node_modules/@lit/reactive-element/decorators/state.js
function O(e) {
	return D({
		...e,
		state: !0,
		attribute: !1
	});
}
//#endregion
//#region src/velair/constants.ts
var k = [
	"monday",
	"tuesday",
	"wednesday",
	"thursday",
	"friday",
	"saturday",
	"sunday"
], Ke = [
	"heat",
	"cool",
	"heat_cool",
	"auto",
	"dry",
	"fan_only",
	"off"
], qe = "set_temperature", Je = "turn_off", Ye = "velair", Xe = 5e3, Ze = [
	"overview",
	"schedules",
	"templates",
	"sensors",
	"comfort",
	"preconditioning",
	"settings"
], Qe = [
	"overview-status",
	"overview-boosts",
	"overview-events",
	"overview-timeline",
	"overview-zones",
	"schedules",
	"sensors",
	"comfort",
	"preconditioning"
], $e = [
	"zones",
	"templates",
	"settings",
	"preconditioning_learning"
], et = /* @__PURE__ */ t({ en: () => tt }), tt = {
	addBlock: "Add block",
	apply: "Apply",
	cloneDayToDays: "Clone day to",
	cloneDayToThermostats: "Clone day to",
	cloneAction: "Clone",
	appliedDays: "Cloned to {count} day{suffix}",
	appliedTemplateTargets: "Applied to {count} targets",
	appliedThermostats: "Cloned to {count} thermostat{suffix}",
	applying: "Applying",
	applyTemplate: "Apply template",
	applyTo: "Apply to",
	applyToAction: "Apply to...",
	applyTemplateTo: "Apply {template} to...",
	boost: "Boost",
	boostActive: "Boost active",
	activeBoosts: "Active boosts",
	availableModes: "Available modes",
	boostTarget: "Boost target",
	boostUntil: "Ends in",
	blocks: "Blocks",
	build: "Build",
	cardView: "Card view",
	cardViewOverviewBoosts: "Overview: active boosts",
	cardViewOverviewEvents: "Overview: next events",
	cardViewOverviewStatus: "Overview: scheduler status",
	cardViewOverviewTimeline: "Overview: today's timeline",
	cardViewOverviewZones: "Overview: zone overview",
	cardViewComfort: "Comfort monitor",
	cardViewSchedules: "Schedules editor",
	cardViewSensors: "Room Assist",
	cardThermostatHidden: "Hidden in this card",
	cardThermostatVisible: "Shown in this card",
	cardThermostats: "Thermostats in this card",
	cardThermostatsDescription: "Choose which thermostats this card shows and arrange their order.",
	comfortCardVisibility: "Comfort card visibility",
	comfortCardVisibilityDescription: "Choose which Comfort setup and live graphs this card shows.",
	comfortCardShowCo2: "Show CO2 graph",
	comfortCardShowConfiguration: "Show configuration",
	comfortCardShowHumidity: "Show humidity graph",
	comfortCardShowTemperature: "Show temperature graph",
	roomAssistCardVisibility: "Room Assist visibility",
	roomAssistCardVisibilityDescription: "Choose which Room Assist controls and status details this card shows.",
	roomAssistShowDebounce: "Show refresh delay",
	roomAssistShowLiveStatus: "Show live status",
	roomAssistShowMaxDelta: "Show maximum assist delta",
	roomAssistShowSensor: "Show room temperature sensor",
	roomAssistShowSwitch: "Show on/off switch",
	current: "Current",
	currentHumidity: "Humidity",
	currentTemperature: "Current temperature",
	currentTime: "Current time: {time}",
	clear: "Clear",
	confirmDeleteTemplate: "Delete template {template}?",
	confirmTemplate: "Replace {weekday} with {template}?",
	comfort: "Comfort",
	comfortAirQuality: "Air quality",
	comfortAirQualityElevated: "CO2 elevated",
	comfortAirQualityGood: "Good air",
	comfortAirQualityPoor: "Poor air quality",
	comfortAirQualityUnavailable: "CO2 unavailable",
	comfortAutomaticSourceValue: "Automatic: {entity}",
	comfortCo2: "CO2",
	comfortCo2Attention: "Elevated",
	comfortCo2Limits: "CO2 limits",
	comfortCo2LimitsHelp: "Elevated marks an early air-quality warning. Poor marks a more serious CO2 level.",
	comfortCo2Poor: "Poor",
	comfortCo2Sensor: "CO2 sensor",
	comfortCollapseClimate: "Collapse {climate}",
	comfortConditionCold: "Cold",
	comfortConditionColdAndDry: "Cold and dry",
	comfortConditionColdAndHumid: "Cold and humid",
	comfortConditionComfortable: "Comfortable",
	comfortConditionDry: "Dry air",
	comfortConditionHot: "Hot",
	comfortConditionHotAndDry: "Hot and dry",
	comfortConditionHotAndHumid: "Hot and humid",
	comfortConditionHumid: "Humid",
	comfortConditionHumidityComfortable: "Humidity in range",
	comfortConditionMonitoringOff: "Monitoring off",
	comfortConditionNoReadings: "No readings",
	comfortConditionReadingsOutdated: "Readings outdated",
	comfortConditionTemperatureComfortable: "Temperature in range",
	comfortCooler: "Cooler",
	comfortCurrentReadings: "Current readings",
	comfortDataFreshness: "Data freshness",
	comfortDataIssueCo2Missing: "CO2 unavailable",
	comfortDataIssueCo2Stale: "CO2 reading outdated",
	comfortDataIssueHumidityMissing: "Humidity unavailable",
	comfortDataIssueHumidityStale: "Humidity reading outdated",
	comfortDataIssueTemperatureMissing: "Temperature unavailable",
	comfortDataIssueTemperatureStale: "Temperature reading outdated",
	comfortDataPartial: "Partial readings",
	comfortDataStale: "Readings outdated",
	comfortDataUnavailable: "No usable readings",
	comfortDisabledDetail: "Comfort monitoring is off for this climate. No comfort sensors are tracked.",
	comfortDoNotMonitor: "Do not monitor CO2",
	comfortDoNotMonitorHumidity: "Do not monitor humidity",
	comfortDrier: "Drier",
	comfortExpandClimate: "Expand {climate}",
	comfortHumidity: "Humidity",
	comfortHumidityRange: "Humidity range",
	comfortHumidityRangeHelp: "Narrower ranges warn sooner; wider ranges are more tolerant.",
	comfortHumiditySensor: "Humidity sensor",
	comfortIntroDetail: "Monitor temperature, humidity and CO2 locally, then use Velair events in Home Assistant automations.",
	comfortIntroTitle: "Environmental comfort",
	comfortMaximum: "Max",
	comfortMinimum: "Min",
	comfortMoreHumid: "More humid",
	comfortMapCurrentPosition: "Current position: {temperature}, {humidity}",
	comfortNotMonitored: "Not monitored",
	comfortSelectSensor: "Use automatic source",
	comfortStaleAfter: "Stale after",
	comfortStaleAfterHelp: "Maximum age since the last Home Assistant state update. Higher trusts older values longer; lower marks stale sensors sooner.",
	comfortTargetZone: "Comfort range",
	comfortTemperature: "Temperature",
	comfortTemperatureRange: "Temperature range",
	comfortTemperatureRangeHelp: "Narrower ranges warn sooner; wider ranges are more tolerant.",
	comfortTemperatureSensor: "Temperature sensor",
	comfortUnavailable: "Climate unavailable",
	comfortWarmer: "Warmer",
	createTemplate: "Create template",
	customTemplateName: "Template name",
	day: "Day",
	daySchedule: "Day schedule",
	defaultZone: "First managed zone",
	deleteBlock: "Delete block",
	deleteTemplate: "Delete template",
	dismiss: "Dismiss",
	duplicateStart: "Duplicate start time: {start}",
	entityDiagnosticMissing: "Entity not found",
	entityDiagnosticNoModes: "No supported HVAC modes reported",
	entityDiagnosticNoRange: "No temperature range reported",
	entityDiagnosticNotClimate: "Entity is not a climate",
	entityDiagnosticOk: "Thermostat configuration looks OK",
	fanMode: "Fan mode",
	horizontalSwingMode: "Horizontal swing",
	invalidStart: "Invalid start time: {start}",
	invalidTemperature: "Invalid temperature for {start}",
	invalidTemperatureRange: "Use {min} to {max}",
	invalidTemperatureStep: "Use {step} steps",
	incompatibleScheduleTargets: "Some schedule targets need review",
	incompatibleScheduleTargetsDescription: "{count} stored target(s) no longer match the thermostat range or temperature step. Open Schedules and save a supported value.",
	operationRecoveryRequired: "Velair saved the data but could not resume",
	operationRecoveryDescription: "Scheduling remains stopped. Reload the Velair integration or restart Home Assistant to complete recovery.",
	keep: "Keep",
	keepMode: "Keep mode",
	tagline: "Climate automation that adapts to your life.",
	loading: "Loading scheduler data...",
	loadingEntities: "Loading managed zones...",
	managedEntityAvailable: "Available",
	managedEntityMissing: "Not found",
	managedEntitiesStatus: "Managed thermostats",
	menu: "Menu",
	minutesShort: "min",
	secondsShort: "s",
	providedData: "Provided data",
	portability: "Portability",
	portabilityDescription: "Export or import Velair data with a versioned JSON file.",
	portabilityFileReady: "{file} ready",
	portabilityIncluded: "Included",
	portabilitySettingsSection: "Settings",
	portabilityTemplatesSection: "Templates",
	portabilityZonesSection: "Thermostat schedules",
	portabilityPreconditioningLearningSection: "Preconditioning learning",
	preconditioningImportSkipped: "Skipped preconditioning learning ({count}). These thermostats are not managed here: {entities}",
	portableExported: "Export file created",
	portableImported: "Import completed",
	importData: "Import",
	importFile: "Import file",
	chooseFile: "Choose file",
	climateOptions: "Climate options",
	climateOptionsAdd: "Add optional settings",
	noFileSelected: "No file selected",
	exportData: "Export",
	invalidImportFile: "This is not a valid Velair export file",
	importOverwriteWarning: "Importing will overwrite existing values. They cannot be recovered unless you exported them first.",
	noImportSections: "No importable sections found",
	legacyImportTemperatureUnit: "This older backup does not record a temperature unit. Velair will treat its temperatures as Celsius and convert them to {target} when needed.",
	notSet: "Not set",
	maintenance: "Maintenance",
	maintenanceDescription: "Technical version details for troubleshooting.",
	frontendBuild: "Frontend build",
	portableFormatVersion: "Portable/export format",
	internalStorageVersion: "Storage/model",
	integrationVersion: "Integration version",
	resetVelair: "Reset Velair",
	resetVelairDescription: "Deletes all stored Velair data, including schedules, templates, panel preferences, active boosts and pauses, Comfort and Room Assist settings, Adaptive Preconditioning settings and learning, and startup behavior. It then recreates unit-aware defaults for the currently managed thermostats.",
	confirmReset: "Reset all stored Velair data? This cannot be undone unless you exported your data first.",
	confirmResetPreconditioningLearning: "Reset adaptive preconditioning learning for {direction}? Schedules and settings will be kept.",
	confirmResetPreconditioningSettings: "Restore the default preconditioning settings for this thermostat? Learning samples will be kept.",
	resetDone: "Velair data reset",
	resetting: "Resetting",
	minTemperature: "Minimum temperature",
	maxTemperature: "Maximum temperature",
	modeOptional: "Mode optional",
	firstWeekday: "First day of week",
	managedZones: "Managed zones",
	mode: "Mode",
	moveDown: "Move down",
	moveUp: "Move up",
	nextEvent: "Next event",
	nextEvents: "Next events",
	noActiveBoosts: "No active boosts",
	noBlocks: "No blocks",
	noManagedEntities: "No managed climate entities found.",
	noTemplates: "No templates",
	newTemplate: "New template",
	noUpcomingEvent: "No upcoming event",
	off: "Off",
	otherDays: "Other days",
	otherThermostats: "Other thermostats",
	overview: "Overview",
	overviewPanelIntro: "The main status view will group scheduler state, upcoming events, active boosts, and quick actions.",
	overviewStatusPaused: "Paused",
	overviewStatusPausedDetail: "Temporary pause active",
	overviewStatusRunning: "Running",
	overviewStatusRunningDetail: "Scheduler is applying schedules",
	overviewStatusStopped: "Stopped",
	overviewStatusStoppedDetail: "Scheduler is stopped until resumed",
	overviewZones: "Zone overview",
	overviewZoneApplied: "Applied",
	overviewZoneAir: "Air: {status}",
	overviewZoneBoost: "Boost",
	overviewZoneComfort: "Comfort: {status}",
	overviewZoneIdle: "Idle / manual",
	overviewZonePaused: "Paused",
	overviewZonePreconditioning: "Preconditioning",
	overviewZoneResumes: "Resumes {time}",
	overviewZoneRoom: "Room",
	overviewZoneRoomAssist: "Room Assist {delta}",
	overviewZoneScheduled: "Scheduled",
	overviewZoneCurrentState: "Now",
	overviewZoneSensorIssue: "Sensor data incomplete",
	overviewZoneStopped: "Stopped",
	overviewZoneTarget: "Target",
	overviewZoneUntil: "Until {time}",
	overviewZoneUntilResumed: "Until resumed",
	overviewZoneReadyAt: "Ready at {time}",
	overviewZoneNextAt: "Next at {time}",
	overviewZoneManualMode: "Manual · {mode}",
	overviewZoneAutomationOff: "Automation off",
	overviewZoneRoomAssistThermalFlow: "Room Assist temperature flow",
	overviewZoneSensor: "Sensor",
	overviewZoneClimate: "Climate",
	overviewZoneTemperature: "Temperature",
	overviewZoneSetpoint: "Setpoint",
	overviewZoneScheduledSetpoint: "Scheduled",
	overviewZoneOffset: "Offset",
	overviewZoneRoomAssistActive: "Active",
	overviewZoneRoomAssistHolding: "Holding",
	overviewZoneComfortLabel: "Comfort",
	overviewZoneAirLabel: "Air",
	overviewZoneDataLabel: "Data",
	pause: "Pause",
	pauseActive: "Paused",
	pauseApplied: "Scheduler paused",
	pauseDuration: "Pause duration (min)",
	pauseFrom: "From",
	pauseIndefinite: "No end time",
	pauseRemaining: "Resumes in",
	pauseTo: "To",
	preconditioning: "Preconditioning",
	preconditioningEnabled: "Preconditioning enabled",
	preconditioningCool: "Cool",
	preconditioningCoolingFallbackLead: "Cooling fallback (min)",
	preconditioningDirectionSamples: "{count}/{required}",
	preconditioningHeat: "Heat",
	preconditioningHeatingFallbackLead: "Heating fallback (min)",
	preconditioningDirectionStatus: "Status",
	preconditioningExpandClimate: "Expand {climate}",
	preconditioningIntroDetail: "Let Velair calculate when a scheduled comfort target should start so the room is closer to temperature on time.",
	preconditioningIntroTitle: "Adaptive comfort timing",
	preconditioningAdaptivePercentile: "Dynamic comfort percentile",
	preconditioningAdaptivePercentileHelp: "On raises the margin after too many partial attempts and reduces it after consistently complete ones.",
	preconditioningCalculationCombined: "Combined",
	preconditioningCalculationDetails: "Calculation details",
	preconditioningCalculationFinalLead: "Final lead",
	preconditioningCalculationPartialFloor: "Partial floor",
	preconditioningCalculationReachedEstimate: "Reached estimate",
	preconditioningCalculationRounded: "Rounded",
	preconditioningCalculationSampleCounts: "Reached: {reached} · Partial: {partial} · Invalid: {invalid}",
	preconditioningCalculationSamples: "Samples",
	preconditioningComfortPercentile: "Comfort percentile",
	preconditioningComfortPercentileHelp: "Higher starts earlier using slower learned cases; lower starts later with less margin.",
	preconditioningComfortPercentileLabel: "Comfort percentile",
	preconditioningCollapseClimate: "Collapse {climate}",
	preconditioningFallbackInactive: "Adaptive model active",
	preconditioningFallbackLabel: "Fallback",
	preconditioningFallbackLead: "{minutes} min",
	preconditioningFallbackMinutesPerDegree: "Initial model",
	preconditioningFallbackMinutesPerDegreeHelp: "Higher starts earlier before enough learning exists; lower starts later.",
	preconditioningHistorySize: "History size",
	preconditioningHistorySizeHelp: "Higher keeps more useful samples; lower forgets older samples sooner.",
	preconditioningHistory: "History",
	preconditioningInvalidEvents: "Invalid",
	preconditioningLastSample: "Last sample",
	preconditioningLeadTime: "{minutes} min early",
	preconditioningLearning: "Learning locally",
	preconditioningLearningStatus: "Learning status",
	preconditioningLearningDisabled: "Learning disabled",
	preconditioningLearningMoreData: "More data needed",
	preconditioningLearningReady: "Learning ready",
	preconditioningLimitedByMax: "Limited by maximum",
	preconditioningLivePrediction: "Live prediction",
	preconditioningLivePredictionHelp: "Uses the next real block to show how the calculated preconditioning start changes.",
	preconditioningMaxLead: "Maximum start (min)",
	preconditioningMaxLeadHelp: "Higher permits earlier starts; lower places a tighter limit on lead time.",
	preconditioningMaximumLabel: "Maximum",
	preconditioningMinimumDelta: "Minimum temperature delta",
	preconditioningMinimumDeltaHelp: "Higher ignores larger small gaps; lower reacts to smaller temperature differences.",
	preconditioningMinStart: "Minimum start (min)",
	preconditioningMinStartHelp: "Higher ignores short predicted leads; lower allows smaller early starts.",
	preconditioningModelHistory: "Similar history",
	preconditioningModel: "Learning model",
	preconditioningModelInitial: "Initial model",
	preconditioningModelSource: "Model source",
	preconditioningNextBlock: "Next block",
	preconditioningNoUpcomingDirectionEvent: "No upcoming {direction} block to predict.",
	preconditioningNormalStart: "Normal start",
	preconditioningNotSupported: "Not supported",
	preconditioningPartialEvents: "Partial",
	preconditioningPartialSamples: "{count} partial",
	preconditioningPartialExpiry: "Partial expiry (days)",
	preconditioningPartialExpiryHelp: "Higher lets incomplete attempts influence predictions longer; lower expires them sooner.",
	preconditioningQualityComplete: "Complete",
	preconditioningQualityInvalid: "Invalid",
	preconditioningQualityPartial: "Partial",
	preconditioningRecencyDecay: "Recency decay (days)",
	preconditioningRecencyDecayHelp: "Higher makes old samples lose weight more slowly; lower favors recent behavior.",
	preconditioningReachedEvents: "Reached",
	preconditioningResetLearning: "Reset learning",
	preconditioningLearningResetDone: "{direction} learning reset",
	preconditioningSimilarSamples: "Similar samples",
	preconditioningSimilarSamplesHelp: "Higher considers more nearby history; lower focuses on the closest cases.",
	preconditioningUnsupportedDirection: "Not supported by this thermostat",
	preconditioningOutdoorTemperatureEntity: "Outdoor temperature sensor",
	preconditioningOutdoorTemperatureEntityHelp: "Provides local outdoor context for comparing learned samples; it does not change the initial model.",
	preconditioningOutdoorContext: "Outdoor context",
	preconditioningOutdoorDisabled: "Disabled",
	preconditioningSelectOutdoorSensor: "Select sensor",
	preconditioningResetSettings: "Restore default settings",
	preconditioningSettingsResetDone: "Preconditioning settings restored",
	preconditioningStarts: "Starts",
	preconditioningTargetBy: "Target by",
	preconditioningTiming: "Timing and limits",
	preconditioningUnavailable: "Thermostat unavailable. Preconditioning cannot be enabled.",
	preconditioningUseOutdoorTemperature: "Use outdoor temperature",
	preconditioningUseOutdoorTemperatureHelp: "On includes outdoor temperature when choosing similar learned samples.",
	resume: "Resume",
	resumed: "Scheduler resumed",
	resizeEnd: "Adjust end",
	resizeStart: "Adjust start",
	schedulerControls: "Scheduler controls",
	schedules: "Schedules",
	sensors: "Room Assist",
	roomSensorAppliedTarget: "Applied target",
	roomSensorAssist: "Room Sensor Assist",
	roomSensorAssistBadge: "Room Assist",
	roomSensorAssistEnabled: "Room Sensor Assist enabled",
	roomSensorAssistHelp: "Temporarily adjusts the climate target so the room sensor can reach the scheduled temperature.",
	roomSensorAssistDisabledDetail: "A room sensor is selected, but Room Sensor Assist is off. Velair keeps using the climate temperature until this switch is enabled.",
	roomSensorAssistDebounce: "Refresh delay",
	roomSensorAssistDebounceHelp: "Seconds to wait after room or climate temperature changes before recalculating the assisted target. Use 0 for immediate updates.",
	roomSensorAssistMaxDelta: "Maximum assist delta",
	roomSensorAssistMaxDeltaHelp: "Higher can keep the valve open longer; lower limits how far Velair can adjust the climate target.",
	roomSensorAssistOffset: "Assist offset",
	roomSensorAssistOffsetHelp: "Temporary offset applied to the climate target so the room sensor can keep moving toward the scheduled temperature.",
	roomSensorAssistCorrectionValue: "Offset {value}",
	roomSensorAssistCorrectionActiveHelp: "Room Assist is adjusting the climate setpoint. This does not indicate whether the climate is actively heating or cooling.",
	roomSensorAssistNoCorrection: "Offset 0 · Holding",
	roomSensorAssistNoCorrectionHelp: "Room Assist is not applying a setpoint correction. The room and scheduled temperatures may still differ.",
	roomSensorBlockActiveSince: "Active from {time}",
	roomSensorBlockMode: "Mode: {mode}",
	roomSensorBlockScheduled: "Scheduled for {time}",
	roomSensorBlockStartedEarly: "Started at {time}",
	roomSensorBlockTarget: "Target: {target}",
	roomSensorGapAboveTarget: "{value} above target",
	roomSensorGapBelowTarget: "{value} below target",
	roomSensorClimateTarget: "Climate target",
	roomSensorClimateTemperature: "Climate reading",
	roomSensorCollapseClimate: "Collapse {climate}",
	roomSensorControl: "Room Sensor Assist",
	roomSensorExpandClimate: "Expand {climate}",
	roomSensorIntroDetail: "Use a room temperature sensor to guide the climate target while Velair runs managed temperature blocks.",
	roomSensorIntroTitle: "Room temperature control",
	roomSensorLiveStatus: "Live status",
	roomSensorNoActiveBlock: "No active temperature block",
	roomSensorNoActiveBlockDetail: "Room Assist will update when a managed temperature block is active.",
	roomSensorNotConfigured: "Select a room sensor first",
	roomSensorRoomTemperature: "Room sensor",
	roomSensorRemainingToTarget: "To target",
	roomSensorRemainingValue: "{value} left",
	roomSensorScheduledTarget: "Scheduled target",
	roomSensorSelectSensor: "Select room sensor",
	roomSensorStatusAssisting: "Assisting",
	roomSensorStatusBlocked: "Blocked",
	roomSensorStatusDisabled: "Disabled",
	roomSensorStatusHolding: "Holding",
	roomSensorStatusIdle: "Idle",
	roomSensorStatusNotConfigured: "Not configured",
	roomSensorStatusReady: "Ready",
	roomSensorStatusUnavailable: "Unavailable",
	roomSensorTemperatureEntity: "Room temperature sensor",
	roomSensorTemperatureEntityHelp: "Sensor that Room Sensor Assist uses as the real room temperature while adjusting the climate target.",
	roomSensorTemperatureScale: "Room Assist temperature scale",
	roomSensorUnavailable: "Climate unavailable",
	roomSensorValueUnavailable: "Unavailable",
	save: "Save",
	saveTemplate: "Save as template",
	saved: "Schedule saved",
	saving: "Saving",
	scheduleCopyHint: "You can also copy this configuration to another day or climate.",
	scheduleEditor: "Schedule editor",
	scheduleStepClimate: "1. Select the climate you want to configure.",
	scheduleStepConfigure: "3. Configure the climate to your liking.",
	scheduleStepDay: "2. Select the day you want to configure.",
	reorderZones: "Drag thermostats to change their order in the panel.",
	selectedWeekday: "Initial day",
	selectedZone: "Initial zone",
	selectTemplatePlaceholder: "Select a template",
	selectTemplateToBegin: "Select a template to begin.",
	setTemperature: "Set temperature",
	settings: "Settings",
	settingsPanelIntro: "Choose how thermostats and weekdays are ordered in this panel.",
	startupBehavior: "Home Assistant startup",
	startsAt: "Starts",
	applyScheduleOnStartup: "Apply active schedule after startup",
	applyScheduleOnStartupDescription: "When Home Assistant starts, Velair can apply the current schedule block to the managed thermostats instead of leaving them as they are.",
	start: "Start",
	status: "Status",
	stop: "Stop",
	supportedFanModes: "Fan modes",
	supportedHorizontalSwingModes: "Horizontal swing modes",
	supportedPresetModes: "Presets",
	supportedSwingModes: "Swing modes",
	presetMode: "Preset",
	swingMode: "Swing",
	temp: "Temp",
	temperatureRange: "Temperature range",
	temperatureUnit: "Temperature unit",
	temperatureUnitManagedByHomeAssistant: "Detected from Home Assistant. Change this value in Home Assistant's unit system settings.",
	temperatureMigrationRequired: "Velair needs your attention",
	temperatureMigrationStopped: "The scheduler and thermal configuration are locked because Home Assistant changed temperature units. Open Velair Settings to migrate safely.",
	temperatureMigrationQuestion: "Migrate stored temperatures from {source} to {target}?",
	temperatureMigrationExplanation: "Continue only if every stored Velair temperature is still in {source}. This migration updates schedules, templates, overrides, Comfort, Room Assist, preconditioning settings, rates, and learning data before resuming the scheduler. If any stored value is already in {target}, migrating it will make that value incorrect.",
	temperatureMigrationUse: "Migrate {source} to {target}",
	temperatureMigrationConfirm: "Confirm that all stored Velair temperature data is in {source} and convert it to {target}? Do not continue if any stored value is already in {target}, because it will become incorrect. The scheduler remains stopped if the migration cannot be saved.",
	temperatureMigrationComplete: "Temperature data updated and scheduler resumed",
	temperatureMigrationFailed: "Unable to update temperature data",
	temperatureLegacyResetQuestion: "Reset legacy Celsius data for {target}?",
	temperatureLegacyResetExplanation: "This installation was created by a Velair version that stored Celsius values only. Because Home Assistant now uses {target}, reset Velair to discard the old data and create safe unit-aware defaults. Future Home Assistant unit changes will offer a full data conversion instead.",
	temperatureLegacyResetStopped: "The scheduler is stopped because this legacy installation contains Celsius-only data while Home Assistant uses Fahrenheit. Open Velair Settings and use Reset Velair to create Fahrenheit defaults.",
	temperatureStep: "Step",
	temperatureStepNotReported: "Not reported by Home Assistant",
	temperatureStepNotReportedDescription: "This climate does not publish target_temp_step. Velair does not infer a temperature step.",
	targetTemp: "Target temp",
	targetHumidity: "Target humidity",
	targetBy: "Target by",
	targetTemperature: "Target temperature",
	todayTimeline: "Today's timeline",
	updateTemplate: "Update template",
	templateDeleted: "Template deleted",
	templateNameRequired: "Template name is required",
	templateOptionalHint: "Choose a template or manually configure the schedule.",
	templateSaved: "Template saved",
	templates: "Templates",
	thermostat: "Thermostat",
	templatesPanelIntro: "Template editing will move here so schedule editing stays focused.",
	time: "Time",
	timeline: "Timeline",
	title: "Title",
	unableApplyThermostats: "Unable to apply schedule to thermostats",
	unableCopy: "Unable to copy schedule",
	unableLoad: "Unable to load scheduler data",
	unablePause: "Unable to pause scheduler",
	unableResume: "Unable to resume scheduler",
	unableReset: "Unable to reset Velair data",
	unableSave: "Unable to save schedule",
	unableSaveSettings: "Unable to save settings",
	unableDeleteTemplate: "Unable to delete template",
	unableExport: "Unable to export data",
	unableSaveTemplate: "Unable to save template",
	unableSubscribe: "Unable to subscribe to scheduler updates",
	unsupportedModeForClimate: "{entity} does not support {mode} at {start}. Change that block to Keep or choose a supported mode before applying.",
	unsaved: "unsaved",
	waiting: "Waiting for scheduler data",
	zoneOrder: "Thermostat order",
	zonesManaged: "{count} zones managed",
	weekdays: {
		monday: "Monday",
		tuesday: "Tuesday",
		wednesday: "Wednesday",
		thursday: "Thursday",
		friday: "Friday",
		saturday: "Saturday",
		sunday: "Sunday"
	},
	schedulerStatuses: {
		idle: "Idle",
		override_active: "Boost active",
		paused: "Paused",
		scheduled: "Scheduled"
	},
	schedulerModes: {
		auto: "Auto",
		paused: "Paused"
	},
	hvacModes: {
		auto: "Auto",
		cool: "Cool",
		dry: "Dry",
		fan_only: "Fan only",
		heat: "Heat",
		heat_cool: "Heat/cool",
		off: "Off"
	},
	hvacActions: {
		cooling: "Cooling",
		drying: "Drying",
		fan: "Fan",
		heating: "Heating",
		idle: "Idle",
		off: "Off"
	}
}, nt = /* @__PURE__ */ t({ es: () => rt }), rt = {
	addBlock: "Añadir bloque",
	apply: "Aplicar",
	cloneDayToDays: "Clonar el día en",
	cloneDayToThermostats: "Clonar el día en",
	cloneAction: "Clonar",
	appliedDays: "Clonado en {count} día{suffix}",
	appliedTemplateTargets: "Plantilla aplicada a {count} destinos",
	appliedThermostats: "Clonado en {count} termostato{suffix}",
	applying: "Aplicando",
	applyTemplate: "Aplicar plantilla",
	applyTo: "Aplicar a",
	applyToAction: "Aplicar a...",
	applyTemplateTo: "Aplicar {template} a...",
	boost: "Refuerzo",
	boostActive: "Refuerzo activo",
	availableModes: "Modos disponibles",
	activeBoosts: "Refuerzos activos",
	boostTarget: "Objetivo del refuerzo",
	boostUntil: "Finaliza en",
	blocks: "Bloques",
	build: "Compilación",
	cardView: "Vista de la tarjeta",
	cardViewOverviewBoosts: "Resumen: refuerzos activos",
	cardViewOverviewEvents: "Resumen: próximos eventos",
	cardViewOverviewStatus: "Resumen: estado del planificador",
	cardViewOverviewTimeline: "Resumen: línea temporal de hoy",
	cardViewOverviewZones: "Resumen: zonas",
	cardViewComfort: "Confort ambiental",
	cardViewSchedules: "Editor de planificación",
	cardViewSensors: "Sensor de estancia",
	cardThermostatHidden: "Oculto en esta tarjeta",
	cardThermostatVisible: "Visible en esta tarjeta",
	cardThermostats: "Termostatos de esta tarjeta",
	cardThermostatsDescription: "Elige qué termostatos muestra esta tarjeta y ordénalos.",
	comfortCardVisibility: "Visibilidad de confort",
	comfortCardVisibilityDescription: "Elige qué configuración y gráficas de confort muestra esta tarjeta.",
	comfortCardShowCo2: "Mostrar gráfica de CO2",
	comfortCardShowConfiguration: "Mostrar configuración",
	comfortCardShowHumidity: "Mostrar gráfica de humedad",
	comfortCardShowTemperature: "Mostrar gráfica de temperatura",
	roomAssistCardVisibility: "Visibilidad del sensor de estancia",
	roomAssistCardVisibilityDescription: "Elige qué controles y detalles de estado muestra esta tarjeta.",
	roomAssistShowDebounce: "Mostrar retraso de actualización",
	roomAssistShowLiveStatus: "Mostrar estado actual",
	roomAssistShowMaxDelta: "Mostrar ajuste máximo",
	roomAssistShowSensor: "Mostrar sensor de temperatura de estancia",
	roomAssistShowSwitch: "Mostrar interruptor de encendido",
	current: "Actual",
	currentHumidity: "Humedad",
	currentTemperature: "Temperatura actual",
	currentTime: "Hora actual: {time}",
	clear: "Limpiar",
	confirmDeleteTemplate: "¿Eliminar la plantilla {template}?",
	confirmTemplate: "¿Reemplazar {weekday} por {template}?",
	comfort: "Confort",
	comfortAirQuality: "Calidad del aire",
	comfortAirQualityElevated: "CO2 elevado",
	comfortAirQualityGood: "Buena",
	comfortAirQualityPoor: "Calidad del aire deficiente",
	comfortAirQualityUnavailable: "CO2 no disponible",
	comfortAutomaticSourceValue: "Automático: {entity}",
	comfortCo2: "CO2",
	comfortCo2Attention: "Elevado",
	comfortCo2Limits: "Límites de CO2",
	comfortCo2LimitsHelp: "El nivel «Elevado» sirve como aviso temprano sobre la calidad del aire. «Deficiente» señala un nivel de CO2 más preocupante.",
	comfortCo2Poor: "Deficiente",
	comfortCo2Sensor: "Sensor de CO2",
	comfortCollapseClimate: "Ocultar {climate}",
	comfortConditionCold: "Frío",
	comfortConditionColdAndDry: "Frío y seco",
	comfortConditionColdAndHumid: "Frío y húmedo",
	comfortConditionComfortable: "Confortable",
	comfortConditionDry: "Ambiente seco",
	comfortConditionHot: "Calor",
	comfortConditionHotAndDry: "Caluroso y seco",
	comfortConditionHotAndHumid: "Caluroso y húmedo",
	comfortConditionHumid: "Ambiente húmedo",
	comfortConditionHumidityComfortable: "Humedad adecuada",
	comfortConditionMonitoringOff: "Monitorización desactivada",
	comfortConditionNoReadings: "Sin lecturas",
	comfortConditionReadingsOutdated: "Lecturas desactualizadas",
	comfortConditionTemperatureComfortable: "Temperatura adecuada",
	comfortCooler: "Más frío",
	comfortCurrentReadings: "Lecturas actuales",
	comfortDataFreshness: "Vigencia de los datos",
	comfortDataIssueCo2Missing: "CO2 no disponible",
	comfortDataIssueCo2Stale: "Lectura de CO2 desactualizada",
	comfortDataIssueHumidityMissing: "Humedad no disponible",
	comfortDataIssueHumidityStale: "Lectura de humedad desactualizada",
	comfortDataIssueTemperatureMissing: "Temperatura no disponible",
	comfortDataIssueTemperatureStale: "Lectura de temperatura desactualizada",
	comfortDataPartial: "Lecturas parciales",
	comfortDataStale: "Lecturas desactualizadas",
	comfortDataUnavailable: "Sin lecturas útiles",
	comfortDisabledDetail: "La monitorización de confort está desactivada para este termostato. Velair no supervisa ningún sensor de confort.",
	comfortDoNotMonitor: "No monitorizar CO2",
	comfortDoNotMonitorHumidity: "No monitorizar humedad",
	comfortDrier: "Más seco",
	comfortExpandClimate: "Mostrar {climate}",
	comfortHumidity: "Humedad",
	comfortHumidityRange: "Rango de humedad",
	comfortHumidityRangeHelp: "Con rangos más estrechos, Velair avisa antes; los rangos más amplios son más tolerantes.",
	comfortHumiditySensor: "Sensor de humedad",
	comfortIntroDetail: "Monitoriza temperatura, humedad y CO2 de forma local, y usa los eventos de Velair en automatizaciones de Home Assistant.",
	comfortIntroTitle: "Confort ambiental",
	comfortMaximum: "Máx.",
	comfortMinimum: "Mín.",
	comfortMoreHumid: "Más húmedo",
	comfortMapCurrentPosition: "Posición actual: {temperature}, {humidity}",
	comfortNotMonitored: "Sin supervisión",
	comfortSelectSensor: "Usar fuente automática",
	comfortStaleAfter: "Desactualizado tras",
	comfortStaleAfterHelp: "Tiempo máximo desde la última actualización de estado en Home Assistant. Un valor mayor confía más tiempo en lecturas antiguas; uno menor marca antes los sensores como desactualizados.",
	comfortTargetZone: "Rango confortable",
	comfortTemperature: "Temperatura",
	comfortTemperatureRange: "Rango de temperatura",
	comfortTemperatureRangeHelp: "Con rangos más estrechos, Velair avisa antes; los rangos más amplios son más tolerantes.",
	comfortTemperatureSensor: "Sensor de temperatura",
	comfortUnavailable: "Termostato no disponible",
	comfortWarmer: "Más cálido",
	createTemplate: "Crear plantilla",
	customTemplateName: "Nombre de la plantilla",
	day: "Día",
	daySchedule: "Planificación del día",
	defaultZone: "Primer termostato gestionado",
	deleteBlock: "Eliminar bloque",
	deleteTemplate: "Eliminar plantilla",
	dismiss: "Cerrar",
	duplicateStart: "Hora duplicada: {start}",
	entityDiagnosticMissing: "Entidad no encontrada",
	entityDiagnosticNoModes: "No informa de los modos HVAC compatibles",
	entityDiagnosticNoRange: "No informa del rango de temperatura",
	entityDiagnosticNotClimate: "La entidad no pertenece al dominio climate de Home Assistant",
	fanMode: "Modo del ventilador",
	horizontalSwingMode: "Oscilación horizontal",
	entityDiagnosticOk: "La configuración del termostato parece correcta",
	invalidStart: "Hora no válida: {start}",
	invalidTemperature: "Temperatura no válida para {start}",
	invalidTemperatureRange: "Debe estar entre {min} y {max}",
	invalidTemperatureStep: "Utiliza pasos de {step}",
	incompatibleScheduleTargets: "Hay consignas que necesitan revisión",
	incompatibleScheduleTargetsDescription: "Consignas guardadas que ya no coinciden con el rango o el paso del termostato: {count}. Abre Planificación y guarda un valor compatible.",
	operationRecoveryRequired: "Velair ha guardado los datos, pero no ha podido reanudarse",
	operationRecoveryDescription: "El planificador sigue detenido. Recarga la integración de Velair o reinicia Home Assistant para completar la recuperación.",
	keep: "Mantener",
	keepMode: "Mantener modo",
	tagline: "Automatiza la climatización para adaptarla a tu vida.",
	loading: "Cargando planificación...",
	loadingEntities: "Cargando termostatos gestionados...",
	managedEntityAvailable: "Disponible",
	managedEntityMissing: "No encontrada",
	managedEntitiesStatus: "Termostatos gestionados",
	menu: "Menú",
	minutesShort: "min",
	secondsShort: "s",
	providedData: "Datos proporcionados",
	portability: "Importación y exportación",
	portabilityDescription: "Exporta o importa datos de Velair con un archivo JSON versionado.",
	portabilityFileReady: "Archivo preparado: {file}",
	portabilityIncluded: "Incluido",
	portabilitySettingsSection: "Ajustes",
	portabilityTemplatesSection: "Plantillas",
	portabilityZonesSection: "Planificación de termostatos",
	portabilityPreconditioningLearningSection: "Aprendizaje de preacondicionamiento",
	preconditioningImportSkipped: "Historiales de preacondicionamiento omitidos ({count}). Estos termostatos no están gestionados aquí: {entities}",
	portableExported: "Archivo de exportación creado",
	portableImported: "Importación completada",
	importData: "Importar",
	importFile: "Archivo de importación",
	chooseFile: "Seleccionar archivo",
	climateOptions: "Opciones del termostato",
	climateOptionsAdd: "Añadir ajustes opcionales",
	noFileSelected: "Ningún archivo seleccionado",
	exportData: "Exportar",
	invalidImportFile: "Este no es un archivo de exportación válido de Velair",
	importOverwriteWarning: "Al importar se sobrescribirán los valores existentes. No podrás recuperarlos salvo que hayas creado antes una exportación.",
	noImportSections: "No hay secciones importables",
	legacyImportTemperatureUnit: "Esta copia de seguridad antigua no guarda la unidad de temperatura. Velair interpretará sus temperaturas como Celsius y las convertirá a {target} cuando sea necesario.",
	notSet: "Sin definir",
	maintenance: "Mantenimiento",
	maintenanceDescription: "Detalles técnicos de versiones para diagnóstico.",
	frontendBuild: "Compilación de la interfaz",
	portableFormatVersion: "Formato de exportación",
	internalStorageVersion: "Almacenamiento/modelo",
	integrationVersion: "Versión de la integración",
	resetVelair: "Restablecer Velair",
	resetVelairDescription: "Borra todos los datos almacenados de Velair, incluidas las planificaciones, plantillas, preferencias del panel, refuerzos y pausas activas, ajustes de Comfort y Room Assist, configuración y aprendizaje de Adaptive Preconditioning y el comportamiento al arrancar. Después recrea valores predeterminados adaptados a la unidad de los termostatos gestionados actualmente.",
	confirmReset: "¿Restablecer todos los datos almacenados de Velair? No podrás deshacerlo salvo que hayas creado antes una exportación.",
	confirmResetPreconditioningLearning: "¿Reiniciar el aprendizaje adaptativo de {direction}? Se conservarán las planificaciones y los ajustes.",
	confirmResetPreconditioningSettings: "¿Restablecer los ajustes de preacondicionamiento de este termostato? Se conservarán las muestras de aprendizaje.",
	resetDone: "Datos de Velair restablecidos",
	resetting: "Restableciendo",
	minTemperature: "Temperatura mínima",
	maxTemperature: "Temperatura máxima",
	modeOptional: "Modo opcional",
	firstWeekday: "Primer día de la semana",
	managedZones: "Termostatos gestionados",
	mode: "Modo",
	moveDown: "Bajar",
	moveUp: "Subir",
	nextEvent: "Próximo evento",
	nextEvents: "Próximos eventos",
	noActiveBoosts: "No hay refuerzos activos",
	noBlocks: "No hay bloques",
	noManagedEntities: "No hay termostatos gestionados.",
	noTemplates: "No hay plantillas",
	newTemplate: "Nueva plantilla",
	noUpcomingEvent: "No hay próximos eventos",
	off: "Apagar",
	otherDays: "Otros días",
	otherThermostats: "Otros termostatos",
	overview: "Resumen",
	overviewPanelIntro: "La vista principal reúne el estado del planificador, los próximos eventos, los refuerzos activos y las acciones rápidas.",
	overviewStatusPaused: "Pausado",
	overviewStatusPausedDetail: "Pausa temporal activa",
	overviewStatusRunning: "En ejecución",
	overviewStatusRunningDetail: "El planificador está aplicando la planificación",
	overviewStatusStopped: "Detenido",
	overviewStatusStoppedDetail: "El planificador está detenido hasta que se reanude",
	overviewZones: "Resumen de zonas",
	overviewZoneApplied: "Aplicada",
	overviewZoneAir: "Aire: {status}",
	overviewZoneBoost: "Boost",
	overviewZoneComfort: "Confort: {status}",
	overviewZoneIdle: "Inactiva / manual",
	overviewZonePaused: "Pausada",
	overviewZonePreconditioning: "Preacondicionando",
	overviewZoneResumes: "Reanuda {time}",
	overviewZoneRoom: "Ambiente",
	overviewZoneRoomAssist: "Room Assist {delta}",
	overviewZoneScheduled: "Programada",
	overviewZoneCurrentState: "Ahora",
	overviewZoneSensorIssue: "Datos de sensores incompletos",
	overviewZoneStopped: "Detenida",
	overviewZoneTarget: "Objetivo",
	overviewZoneUntil: "Hasta {time}",
	overviewZoneUntilResumed: "Hasta reanudar",
	overviewZoneReadyAt: "Lista a las {time}",
	overviewZoneNextAt: "Siguiente a las {time}",
	overviewZoneManualMode: "Manual · {mode}",
	overviewZoneAutomationOff: "Automatización desactivada",
	overviewZoneRoomAssistThermalFlow: "Flujo de temperaturas de Room Assist",
	overviewZoneSensor: "Sensor",
	overviewZoneClimate: "Termostato",
	overviewZoneTemperature: "Temperatura",
	overviewZoneSetpoint: "Consigna",
	overviewZoneScheduledSetpoint: "Programada",
	overviewZoneOffset: "Offset",
	overviewZoneRoomAssistActive: "Activo",
	overviewZoneRoomAssistHolding: "Manteniendo",
	overviewZoneComfortLabel: "Confort",
	overviewZoneAirLabel: "Aire",
	overviewZoneDataLabel: "Datos",
	pause: "Pausar",
	pauseActive: "En pausa",
	pauseApplied: "Planificador en pausa",
	pauseDuration: "Duración de la pausa (min)",
	pauseFrom: "Desde",
	pauseIndefinite: "Sin hora de fin",
	pauseRemaining: "Se reanuda en",
	pauseTo: "Hasta",
	preconditioning: "Preacondicionamiento",
	preconditioningEnabled: "Preacondicionamiento activado",
	preconditioningCool: "Refrigeración",
	preconditioningCoolingFallbackLead: "Margen inicial de refrigeración (min)",
	preconditioningDirectionSamples: "{count}/{required}",
	preconditioningHeat: "Calefacción",
	preconditioningHeatingFallbackLead: "Margen inicial de calefacción (min)",
	preconditioningDirectionStatus: "Estado",
	preconditioningExpandClimate: "Mostrar ajustes de {climate}",
	preconditioningIntroDetail: "Permite que Velair calcule cuándo debe iniciar el preacondicionamiento para que la estancia se acerque a tiempo a la temperatura programada.",
	preconditioningIntroTitle: "Anticipación adaptativa",
	preconditioningAdaptivePercentile: "Percentil dinámico de confort",
	preconditioningAdaptivePercentileHelp: "Al activarlo, aumenta el margen tras demasiados intentos parciales y lo reduce cuando los intentos se completan de forma consistente.",
	preconditioningCalculationCombined: "Combinado",
	preconditioningCalculationDetails: "Detalles del cálculo",
	preconditioningCalculationFinalLead: "Anticipación final",
	preconditioningCalculationPartialFloor: "Límite inferior de muestras parciales",
	preconditioningCalculationReachedEstimate: "Estimación con muestras completas",
	preconditioningCalculationRounded: "Redondeado",
	preconditioningCalculationSampleCounts: "Completadas: {reached} · Parciales: {partial} · Inválidas: {invalid}",
	preconditioningCalculationSamples: "Muestras",
	preconditioningComfortPercentile: "Percentil de confort",
	preconditioningComfortPercentileHelp: "Un valor mayor inicia antes usando los casos más lentos del historial; uno menor inicia más tarde con menos margen.",
	preconditioningComfortPercentileLabel: "Percentil de confort",
	preconditioningCollapseClimate: "Ocultar ajustes de {climate}",
	preconditioningFallbackInactive: "Modelo adaptativo activo",
	preconditioningFallbackLabel: "Modelo inicial",
	preconditioningFallbackLead: "{minutes} min",
	preconditioningFallbackMinutesPerDegree: "Modelo inicial",
	preconditioningFallbackMinutesPerDegreeHelp: "Un valor mayor inicia antes mientras faltan muestras; uno menor inicia más tarde.",
	preconditioningHistorySize: "Tamaño del historial",
	preconditioningHistorySizeHelp: "Un valor mayor conserva más muestras útiles; uno menor descarta antes las antiguas.",
	preconditioningHistory: "Historial",
	preconditioningInvalidEvents: "Inválidas",
	preconditioningLastSample: "Última muestra",
	preconditioningLeadTime: "{minutes} min antes",
	preconditioningLearning: "Aprendizaje local en curso",
	preconditioningLearningStatus: "Estado del aprendizaje",
	preconditioningLearningDisabled: "Aprendizaje desactivado",
	preconditioningLearningMoreData: "Faltan datos",
	preconditioningLearningReady: "Modelo listo",
	preconditioningLimitedByMax: "Limitado por el máximo",
	preconditioningLivePrediction: "Predicción actual",
	preconditioningLivePredictionHelp: "Usa el próximo bloque real para mostrar cómo cambia el inicio calculado del preacondicionamiento.",
	preconditioningMaxLead: "Anticipación máxima (min)",
	preconditioningMaxLeadHelp: "Un valor mayor permite iniciar antes; uno menor limita más la antelación.",
	preconditioningMaximumLabel: "Máximo",
	preconditioningMinimumDelta: "Diferencia mínima de temperatura",
	preconditioningMinimumDeltaHelp: "Un valor mayor hace que se ignoren diferencias más grandes; uno menor permite reaccionar ante variaciones más leves.",
	preconditioningMinStart: "Anticipación mínima (min)",
	preconditioningMinStartHelp: "Un valor mayor ignora anticipaciones cortas; uno menor permite anticipaciones más breves.",
	preconditioningModelHistory: "Historial de casos similares",
	preconditioningModel: "Modelo de aprendizaje",
	preconditioningModelInitial: "Modelo inicial",
	preconditioningModelSource: "Fuente del modelo",
	preconditioningNextBlock: "Próximo bloque",
	preconditioningNoUpcomingDirectionEvent: "No hay ningún bloque próximo de {direction} para el que calcular una predicción.",
	preconditioningNormalStart: "Inicio normal",
	preconditioningNotSupported: "No compatible",
	preconditioningPartialEvents: "Parciales",
	preconditioningPartialSamples: "Muestras parciales: {count}",
	preconditioningPartialExpiry: "Caducidad de muestras parciales (días)",
	preconditioningPartialExpiryHelp: "Un valor mayor mantiene durante más tiempo la influencia de los intentos incompletos; uno menor los descarta antes.",
	preconditioningQualityComplete: "Completa",
	preconditioningQualityInvalid: "Inválida",
	preconditioningQualityPartial: "Parcial",
	preconditioningRecencyDecay: "Pérdida de peso por antigüedad (días)",
	preconditioningRecencyDecayHelp: "Un valor mayor hace que las muestras antiguas pierdan peso más despacio; uno menor prioriza las recientes.",
	preconditioningReachedEvents: "Completadas",
	preconditioningResetLearning: "Reiniciar aprendizaje",
	preconditioningLearningResetDone: "Aprendizaje para {direction} reiniciado",
	preconditioningSimilarSamples: "Muestras similares",
	preconditioningSimilarSamplesHelp: "Un valor mayor tiene en cuenta más muestras cercanas del historial; uno menor se centra en los casos más parecidos.",
	preconditioningUnsupportedDirection: "No compatible con este termostato",
	preconditioningOutdoorTemperatureEntity: "Sensor de temperatura exterior",
	preconditioningOutdoorTemperatureEntityHelp: "Aporta el contexto exterior local al comparar muestras; no modifica el modelo inicial.",
	preconditioningOutdoorContext: "Contexto exterior",
	preconditioningOutdoorDisabled: "Desactivado",
	preconditioningSelectOutdoorSensor: "Seleccionar sensor",
	preconditioningResetSettings: "Restablecer ajustes predeterminados",
	preconditioningSettingsResetDone: "Ajustes de preacondicionamiento restablecidos",
	preconditioningStarts: "Inicio",
	preconditioningTargetBy: "Objetivo a las",
	preconditioningTiming: "Tiempos y límites",
	preconditioningUnavailable: "Termostato no disponible. No se puede activar el preacondicionamiento.",
	preconditioningUseOutdoorTemperature: "Usar temperatura exterior",
	preconditioningUseOutdoorTemperatureHelp: "Al activarlo, incluye la temperatura exterior al elegir muestras similares del historial.",
	resume: "Reanudar",
	resumed: "Planificador reanudado",
	resizeEnd: "Ajustar fin",
	resizeStart: "Ajustar inicio",
	schedulerControls: "Controles del planificador",
	schedules: "Planificación",
	sensors: "Sensor de estancia",
	roomSensorAppliedTarget: "Consigna aplicada",
	roomSensorAssist: "Control por sensor de estancia",
	roomSensorAssistBadge: "Sensor de estancia",
	roomSensorAssistEnabled: "Control por sensor de estancia activado",
	roomSensorAssistHelp: "Ajusta temporalmente la consigna del termostato para que el sensor de estancia alcance la temperatura programada.",
	roomSensorAssistDisabledDetail: "Hay un sensor de estancia seleccionado, pero el control está desactivado. Velair seguirá usando la temperatura del termostato hasta que actives este interruptor.",
	roomSensorAssistDebounce: "Retraso de actualización",
	roomSensorAssistDebounceHelp: "Segundos de espera tras cambios de temperatura de la estancia o del termostato antes de recalcular la consigna asistida. Usa 0 para actualizar inmediatamente.",
	roomSensorAssistMaxDelta: "Ajuste máximo de control",
	roomSensorAssistMaxDeltaHelp: "Un valor mayor puede mantener la válvula abierta más tiempo; uno menor limita cuánto puede ajustar Velair la consigna del termostato.",
	roomSensorAssistOffset: "Offset de control",
	roomSensorAssistOffsetHelp: "Offset temporal aplicado a la consigna del termostato para acercar la temperatura de la estancia a la programada.",
	roomSensorAssistCorrectionValue: "Offset {value}",
	roomSensorAssistCorrectionActiveHelp: "Room Assist está ajustando la consigna del termostato. Esto no indica si el termostato está calentando o enfriando activamente.",
	roomSensorAssistNoCorrection: "Offset 0 · Manteniendo",
	roomSensorAssistNoCorrectionHelp: "Room Assist no está aplicando una corrección de consigna. La temperatura de la estancia y la consigna programada aún pueden ser diferentes.",
	roomSensorBlockActiveSince: "Activo desde {time}",
	roomSensorBlockMode: "Modo: {mode}",
	roomSensorBlockScheduled: "Programado a las {time}",
	roomSensorBlockStartedEarly: "Iniciado a las {time}",
	roomSensorBlockTarget: "Objetivo: {target}",
	roomSensorGapAboveTarget: "{value} por encima del objetivo",
	roomSensorGapBelowTarget: "{value} por debajo del objetivo",
	roomSensorClimateTarget: "Consigna del termostato",
	roomSensorClimateTemperature: "Lectura del termostato",
	roomSensorCollapseClimate: "Ocultar {climate}",
	roomSensorControl: "Control por sensor de estancia",
	roomSensorExpandClimate: "Mostrar {climate}",
	roomSensorIntroDetail: "Usa un sensor de estancia para guiar la consigna del termostato mientras Velair ejecuta los bloques de temperatura programados.",
	roomSensorIntroTitle: "Control por temperatura de estancia",
	roomSensorLiveStatus: "Estado actual",
	roomSensorNoActiveBlock: "Sin bloque de temperatura activo",
	roomSensorNoActiveBlockDetail: "El control se actualizará cuando haya un bloque de temperatura programado activo.",
	roomSensorNotConfigured: "Selecciona primero un sensor de estancia",
	roomSensorRoomTemperature: "Sensor de estancia",
	roomSensorRemainingToTarget: "Diferencia hasta el objetivo",
	roomSensorRemainingValue: "Faltan {value}",
	roomSensorScheduledTarget: "Objetivo programado",
	roomSensorSelectSensor: "Seleccionar sensor de estancia",
	roomSensorStatusAssisting: "Ajustando",
	roomSensorStatusBlocked: "Bloqueado",
	roomSensorStatusDisabled: "Desactivado",
	roomSensorStatusHolding: "Manteniendo",
	roomSensorStatusIdle: "En espera",
	roomSensorStatusNotConfigured: "Sin configurar",
	roomSensorStatusReady: "Listo",
	roomSensorStatusUnavailable: "No disponible",
	roomSensorTemperatureEntity: "Sensor de temperatura de estancia",
	roomSensorTemperatureEntityHelp: "Sensor que el control usa como temperatura real de la estancia mientras ajusta la consigna del termostato.",
	roomSensorTemperatureScale: "Escala de temperaturas de Room Assist",
	roomSensorUnavailable: "Termostato no disponible",
	roomSensorValueUnavailable: "No disponible",
	save: "Guardar",
	saveTemplate: "Guardar como plantilla",
	saved: "Planificación guardada",
	saving: "Guardando",
	scheduleCopyHint: "También puedes copiar esta configuración a otro día o termostato.",
	scheduleEditor: "Editor de planificación",
	scheduleStepClimate: "1. Selecciona el termostato que quieres configurar.",
	scheduleStepConfigure: "3. Configura el termostato a tu gusto.",
	scheduleStepDay: "2. Selecciona el día que quieres configurar.",
	reorderZones: "Usa las flechas o arrastra el control para cambiar el orden de los termostatos.",
	selectedWeekday: "Día inicial",
	selectedZone: "Termostato inicial",
	selectTemplatePlaceholder: "Selecciona una plantilla",
	selectTemplateToBegin: "Selecciona una plantilla para comenzar.",
	setTemperature: "Ajustar temperatura",
	settings: "Ajustes",
	settingsPanelIntro: "Elige el orden de los termostatos y el primer día de la semana.",
	startupBehavior: "Inicio de Home Assistant",
	startsAt: "Empieza",
	applyScheduleOnStartup: "Aplicar la planificación activa al arrancar",
	applyScheduleOnStartupDescription: "Cuando Home Assistant arranque, Velair puede aplicar el bloque programado vigente a los termostatos gestionados en lugar de dejarlos como estén.",
	start: "Hora",
	status: "Estado",
	stop: "Detener",
	supportedFanModes: "Modos de ventilador",
	supportedHorizontalSwingModes: "Modos de oscilación horizontal",
	supportedPresetModes: "Preajustes",
	supportedSwingModes: "Oscilación",
	presetMode: "Preajuste",
	swingMode: "Oscilación",
	temp: "Temp.",
	temperatureRange: "Rango de temperatura",
	temperatureUnit: "Unidad de temperatura",
	temperatureUnitManagedByHomeAssistant: "Detectada en Home Assistant. Para cambiarla, modifica el sistema de unidades de Home Assistant.",
	temperatureMigrationRequired: "Velair necesita tu atención",
	temperatureMigrationStopped: "El planificador y la configuración térmica están bloqueados porque Home Assistant ha cambiado de unidad. Abre los ajustes de Velair para migrar los datos con seguridad.",
	temperatureMigrationQuestion: "¿Migrar las temperaturas guardadas de {source} a {target}?",
	temperatureMigrationExplanation: "Continúa solo si todas las temperaturas guardadas por Velair siguen estando en {source}. La migración actualiza planificaciones, plantillas, anulaciones, Comfort, Room Assist, ajustes y ritmos de calentamiento y enfriamiento, además de los datos de aprendizaje de Adaptive Preconditioning, antes de reanudar el planificador. Si algún valor guardado ya está en {target}, la migración lo dejará incorrecto.",
	temperatureMigrationUse: "Migrar de {source} a {target}",
	temperatureMigrationConfirm: "¿Confirmas que todos los datos de temperatura guardados por Velair están en {source} y quieres convertirlos a {target}? No continúes si algún valor ya está en {target}, porque quedará incorrecto. El planificador seguirá detenido si la migración no puede guardarse.",
	temperatureMigrationComplete: "Datos de temperatura actualizados y planificador reanudado",
	temperatureMigrationFailed: "No se han podido actualizar los datos de temperatura",
	temperatureLegacyResetQuestion: "¿Restablecer los datos antiguos en Celsius para usar {target}?",
	temperatureLegacyResetExplanation: "Esta instalación se creó con una versión de Velair que solo guardaba valores en Celsius. Como Home Assistant ahora usa {target}, restablece Velair para borrar los datos anteriores y crear valores predeterminados seguros para esa unidad. Los futuros cambios de unidad de Home Assistant sí ofrecerán una conversión completa de los datos.",
	temperatureLegacyResetStopped: "El planificador está detenido porque esta instalación antigua contiene datos solo en Celsius mientras Home Assistant usa Fahrenheit. Abre los ajustes de Velair y usa Restablecer Velair para crear valores predeterminados en Fahrenheit.",
	temperatureStep: "Paso",
	temperatureStepNotReported: "No proporcionado por Home Assistant",
	temperatureStepNotReportedDescription: "Esta entidad climate no proporciona el atributo target_temp_step. Velair no intenta deducir el paso de temperatura.",
	targetTemp: "Temp. objetivo",
	targetHumidity: "Humedad objetivo",
	targetBy: "Objetivo a las",
	targetTemperature: "Temperatura objetivo",
	todayTimeline: "Línea temporal de hoy",
	updateTemplate: "Actualizar plantilla",
	templateDeleted: "Plantilla eliminada",
	templateNameRequired: "El nombre de la plantilla es obligatorio",
	templateOptionalHint: "Selecciona una plantilla o configura manualmente la planificación.",
	templateSaved: "Plantilla guardada",
	templates: "Plantillas",
	thermostat: "Termostato",
	templatesPanelIntro: "Crea y reutiliza plantillas sin sobrecargar el editor de planificación.",
	time: "Hora",
	timeline: "Línea temporal",
	title: "Título",
	unableApplyThermostats: "No se pudo aplicar la planificación a los termostatos",
	unableCopy: "No se pudo copiar la planificación",
	unableLoad: "No se pudieron cargar los datos",
	unablePause: "No se pudo pausar el planificador",
	unableResume: "No se pudo reanudar el planificador",
	unableReset: "No se pudieron restablecer los datos de Velair",
	unableSave: "No se pudo guardar la planificación",
	unableSaveSettings: "No se pudieron guardar los ajustes",
	unableDeleteTemplate: "No se pudo eliminar la plantilla",
	unableExport: "No se pudieron exportar los datos",
	unableSaveTemplate: "No se pudo guardar la plantilla",
	unableSubscribe: "No se pudo suscribir a las actualizaciones",
	unsupportedModeForClimate: "{entity} no es compatible con el modo {mode} a las {start}. Cambia ese bloque a Mantener o elige un modo compatible antes de aplicar.",
	unsaved: "sin guardar",
	waiting: "Esperando datos de planificación",
	zoneOrder: "Orden de termostatos",
	zonesManaged: "Zonas gestionadas: {count}",
	weekdays: {
		monday: "Lunes",
		tuesday: "Martes",
		wednesday: "Miércoles",
		thursday: "Jueves",
		friday: "Viernes",
		saturday: "Sábado",
		sunday: "Domingo"
	},
	schedulerStatuses: {
		idle: "En espera",
		override_active: "Refuerzo activo",
		paused: "Pausado",
		scheduled: "Programado"
	},
	schedulerModes: {
		auto: "Automático",
		paused: "Pausado"
	},
	hvacModes: {
		auto: "Automático",
		cool: "Frío",
		dry: "Deshumidificación",
		fan_only: "Ventilador",
		heat: "Calor",
		heat_cool: "Calor/frío",
		off: "Apagado"
	},
	hvacActions: {
		cooling: "Enfriando",
		drying: "Deshumidificando",
		fan: "Ventilando",
		heating: "Calentando",
		idle: "En espera",
		off: "Apagado"
	}
}, it = /* @__PURE__ */ t({ translationTemplate: () => at }), at = {
	addBlock: "",
	apply: "",
	cloneDayToDays: "",
	cloneDayToThermostats: "",
	cloneAction: "",
	appliedDays: "",
	appliedTemplateTargets: "",
	appliedThermostats: "",
	applying: "",
	applyTemplate: "",
	applyTo: "",
	applyToAction: "",
	applyTemplateTo: "",
	boost: "",
	boostActive: "",
	activeBoosts: "",
	availableModes: "",
	boostTarget: "",
	boostUntil: "",
	blocks: "",
	build: "",
	cardView: "",
	cardViewOverviewBoosts: "",
	cardViewOverviewEvents: "",
	cardViewOverviewStatus: "",
	cardViewOverviewTimeline: "",
	cardViewOverviewZones: "",
	cardViewComfort: "",
	cardViewSchedules: "",
	cardViewSensors: "",
	cardThermostatHidden: "",
	cardThermostatVisible: "",
	cardThermostats: "",
	cardThermostatsDescription: "",
	comfortCardVisibility: "",
	comfortCardVisibilityDescription: "",
	comfortCardShowCo2: "",
	comfortCardShowConfiguration: "",
	comfortCardShowHumidity: "",
	comfortCardShowTemperature: "",
	roomAssistCardVisibility: "",
	roomAssistCardVisibilityDescription: "",
	roomAssistShowDebounce: "",
	roomAssistShowLiveStatus: "",
	roomAssistShowMaxDelta: "",
	roomAssistShowSensor: "",
	roomAssistShowSwitch: "",
	current: "",
	currentHumidity: "",
	currentTemperature: "",
	currentTime: "",
	clear: "",
	confirmDeleteTemplate: "",
	confirmTemplate: "",
	comfort: "",
	comfortAirQuality: "",
	comfortAirQualityElevated: "",
	comfortAirQualityGood: "",
	comfortAirQualityPoor: "",
	comfortAirQualityUnavailable: "",
	comfortAutomaticSourceValue: "",
	comfortCo2: "",
	comfortCo2Attention: "",
	comfortCo2Limits: "",
	comfortCo2LimitsHelp: "",
	comfortCo2Poor: "",
	comfortCo2Sensor: "",
	comfortCollapseClimate: "",
	comfortConditionCold: "",
	comfortConditionColdAndDry: "",
	comfortConditionColdAndHumid: "",
	comfortConditionComfortable: "",
	comfortConditionDry: "",
	comfortConditionHot: "",
	comfortConditionHotAndDry: "",
	comfortConditionHotAndHumid: "",
	comfortConditionHumid: "",
	comfortConditionHumidityComfortable: "",
	comfortConditionMonitoringOff: "",
	comfortConditionNoReadings: "",
	comfortConditionReadingsOutdated: "",
	comfortConditionTemperatureComfortable: "",
	comfortCooler: "",
	comfortCurrentReadings: "",
	comfortDataFreshness: "",
	comfortDataIssueCo2Missing: "",
	comfortDataIssueCo2Stale: "",
	comfortDataIssueHumidityMissing: "",
	comfortDataIssueHumidityStale: "",
	comfortDataIssueTemperatureMissing: "",
	comfortDataIssueTemperatureStale: "",
	comfortDataPartial: "",
	comfortDataStale: "",
	comfortDataUnavailable: "",
	comfortDisabledDetail: "",
	comfortDoNotMonitor: "",
	comfortDoNotMonitorHumidity: "",
	comfortDrier: "",
	comfortExpandClimate: "",
	comfortHumidity: "",
	comfortHumidityRange: "",
	comfortHumidityRangeHelp: "",
	comfortHumiditySensor: "",
	comfortIntroDetail: "",
	comfortIntroTitle: "",
	comfortMaximum: "",
	comfortMinimum: "",
	comfortMoreHumid: "",
	comfortMapCurrentPosition: "",
	comfortNotMonitored: "",
	comfortSelectSensor: "",
	comfortStaleAfter: "",
	comfortStaleAfterHelp: "",
	comfortTargetZone: "",
	comfortTemperature: "",
	comfortTemperatureRange: "",
	comfortTemperatureRangeHelp: "",
	comfortTemperatureSensor: "",
	comfortUnavailable: "",
	comfortWarmer: "",
	createTemplate: "",
	customTemplateName: "",
	day: "",
	daySchedule: "",
	defaultZone: "",
	deleteBlock: "",
	deleteTemplate: "",
	dismiss: "",
	duplicateStart: "",
	entityDiagnosticMissing: "",
	entityDiagnosticNoModes: "",
	entityDiagnosticNoRange: "",
	entityDiagnosticNotClimate: "",
	fanMode: "",
	horizontalSwingMode: "",
	entityDiagnosticOk: "",
	invalidStart: "",
	invalidTemperature: "",
	invalidTemperatureRange: "",
	invalidTemperatureStep: "",
	incompatibleScheduleTargets: "",
	incompatibleScheduleTargetsDescription: "",
	operationRecoveryRequired: "",
	operationRecoveryDescription: "",
	keep: "",
	keepMode: "",
	tagline: "",
	loading: "",
	loadingEntities: "",
	managedEntityAvailable: "",
	managedEntityMissing: "",
	managedEntitiesStatus: "",
	menu: "",
	minutesShort: "",
	secondsShort: "",
	providedData: "",
	portability: "",
	portabilityDescription: "",
	portabilityFileReady: "",
	portabilityIncluded: "",
	portabilitySettingsSection: "",
	portabilityTemplatesSection: "",
	portabilityZonesSection: "",
	portabilityPreconditioningLearningSection: "",
	preconditioningImportSkipped: "",
	portableExported: "",
	portableImported: "",
	importData: "",
	importFile: "",
	chooseFile: "",
	climateOptions: "",
	climateOptionsAdd: "",
	noFileSelected: "",
	exportData: "",
	invalidImportFile: "",
	importOverwriteWarning: "",
	noImportSections: "",
	legacyImportTemperatureUnit: "",
	notSet: "",
	maintenance: "",
	maintenanceDescription: "",
	frontendBuild: "",
	portableFormatVersion: "",
	internalStorageVersion: "",
	integrationVersion: "",
	resetVelair: "",
	resetVelairDescription: "",
	confirmReset: "",
	confirmResetPreconditioningLearning: "",
	confirmResetPreconditioningSettings: "",
	resetDone: "",
	resetting: "",
	minTemperature: "",
	maxTemperature: "",
	modeOptional: "",
	firstWeekday: "",
	managedZones: "",
	mode: "",
	moveDown: "",
	moveUp: "",
	nextEvent: "",
	nextEvents: "",
	noActiveBoosts: "",
	noBlocks: "",
	noManagedEntities: "",
	noTemplates: "",
	newTemplate: "",
	noUpcomingEvent: "",
	off: "",
	otherDays: "",
	otherThermostats: "",
	overview: "",
	overviewPanelIntro: "",
	overviewStatusPaused: "",
	overviewStatusPausedDetail: "",
	overviewStatusRunning: "",
	overviewStatusRunningDetail: "",
	overviewStatusStopped: "",
	overviewStatusStoppedDetail: "",
	overviewZones: "",
	overviewZoneApplied: "",
	overviewZoneAir: "",
	overviewZoneBoost: "",
	overviewZoneComfort: "",
	overviewZoneIdle: "",
	overviewZonePaused: "",
	overviewZonePreconditioning: "",
	overviewZoneResumes: "",
	overviewZoneRoom: "",
	overviewZoneRoomAssist: "",
	overviewZoneScheduled: "",
	overviewZoneCurrentState: "",
	overviewZoneSensorIssue: "",
	overviewZoneStopped: "",
	overviewZoneTarget: "",
	overviewZoneUntil: "",
	overviewZoneUntilResumed: "",
	overviewZoneReadyAt: "",
	overviewZoneNextAt: "",
	overviewZoneManualMode: "",
	overviewZoneAutomationOff: "",
	overviewZoneRoomAssistThermalFlow: "",
	overviewZoneSensor: "",
	overviewZoneClimate: "",
	overviewZoneTemperature: "",
	overviewZoneSetpoint: "",
	overviewZoneScheduledSetpoint: "",
	overviewZoneOffset: "",
	overviewZoneRoomAssistActive: "",
	overviewZoneRoomAssistHolding: "",
	overviewZoneComfortLabel: "",
	overviewZoneAirLabel: "",
	overviewZoneDataLabel: "",
	pause: "",
	pauseActive: "",
	pauseApplied: "",
	pauseDuration: "",
	pauseFrom: "",
	pauseIndefinite: "",
	pauseRemaining: "",
	pauseTo: "",
	preconditioning: "",
	preconditioningEnabled: "",
	preconditioningCool: "",
	preconditioningCoolingFallbackLead: "",
	preconditioningDirectionSamples: "",
	preconditioningHeat: "",
	preconditioningHeatingFallbackLead: "",
	preconditioningDirectionStatus: "",
	preconditioningExpandClimate: "",
	preconditioningIntroDetail: "",
	preconditioningIntroTitle: "",
	preconditioningAdaptivePercentile: "",
	preconditioningAdaptivePercentileHelp: "",
	preconditioningCalculationCombined: "",
	preconditioningCalculationDetails: "",
	preconditioningCalculationFinalLead: "",
	preconditioningCalculationPartialFloor: "",
	preconditioningCalculationReachedEstimate: "",
	preconditioningCalculationRounded: "",
	preconditioningCalculationSampleCounts: "",
	preconditioningCalculationSamples: "",
	preconditioningComfortPercentile: "",
	preconditioningComfortPercentileHelp: "",
	preconditioningComfortPercentileLabel: "",
	preconditioningCollapseClimate: "",
	preconditioningFallbackInactive: "",
	preconditioningFallbackLabel: "",
	preconditioningFallbackLead: "",
	preconditioningFallbackMinutesPerDegree: "",
	preconditioningFallbackMinutesPerDegreeHelp: "",
	preconditioningHistorySize: "",
	preconditioningHistorySizeHelp: "",
	preconditioningHistory: "",
	preconditioningInvalidEvents: "",
	preconditioningLastSample: "",
	preconditioningLeadTime: "",
	preconditioningLearning: "",
	preconditioningLearningStatus: "",
	preconditioningLearningDisabled: "",
	preconditioningLearningMoreData: "",
	preconditioningLearningReady: "",
	preconditioningLimitedByMax: "",
	preconditioningLivePrediction: "",
	preconditioningLivePredictionHelp: "",
	preconditioningMaxLead: "",
	preconditioningMaxLeadHelp: "",
	preconditioningMaximumLabel: "",
	preconditioningMinimumDelta: "",
	preconditioningMinimumDeltaHelp: "",
	preconditioningMinStart: "",
	preconditioningMinStartHelp: "",
	preconditioningModelHistory: "",
	preconditioningModel: "",
	preconditioningModelInitial: "",
	preconditioningModelSource: "",
	preconditioningNextBlock: "",
	preconditioningNoUpcomingDirectionEvent: "",
	preconditioningNormalStart: "",
	preconditioningNotSupported: "",
	preconditioningPartialEvents: "",
	preconditioningPartialSamples: "",
	preconditioningPartialExpiry: "",
	preconditioningPartialExpiryHelp: "",
	preconditioningQualityComplete: "",
	preconditioningQualityInvalid: "",
	preconditioningQualityPartial: "",
	preconditioningRecencyDecay: "",
	preconditioningRecencyDecayHelp: "",
	preconditioningReachedEvents: "",
	preconditioningResetLearning: "",
	preconditioningLearningResetDone: "",
	preconditioningSimilarSamples: "",
	preconditioningSimilarSamplesHelp: "",
	preconditioningUnsupportedDirection: "",
	preconditioningOutdoorTemperatureEntity: "",
	preconditioningOutdoorTemperatureEntityHelp: "",
	preconditioningOutdoorContext: "",
	preconditioningOutdoorDisabled: "",
	preconditioningSelectOutdoorSensor: "",
	preconditioningResetSettings: "",
	preconditioningSettingsResetDone: "",
	preconditioningStarts: "",
	preconditioningTargetBy: "",
	preconditioningTiming: "",
	preconditioningUnavailable: "",
	preconditioningUseOutdoorTemperature: "",
	preconditioningUseOutdoorTemperatureHelp: "",
	resume: "",
	resumed: "",
	resizeEnd: "",
	resizeStart: "",
	schedulerControls: "",
	schedules: "",
	sensors: "",
	roomSensorAppliedTarget: "",
	roomSensorAssist: "",
	roomSensorAssistBadge: "",
	roomSensorAssistEnabled: "",
	roomSensorAssistHelp: "",
	roomSensorAssistDisabledDetail: "",
	roomSensorAssistDebounce: "",
	roomSensorAssistDebounceHelp: "",
	roomSensorAssistMaxDelta: "",
	roomSensorAssistMaxDeltaHelp: "",
	roomSensorAssistOffset: "",
	roomSensorAssistOffsetHelp: "",
	roomSensorAssistCorrectionValue: "",
	roomSensorAssistCorrectionActiveHelp: "",
	roomSensorAssistNoCorrection: "",
	roomSensorAssistNoCorrectionHelp: "",
	roomSensorBlockActiveSince: "",
	roomSensorBlockMode: "",
	roomSensorBlockScheduled: "",
	roomSensorBlockStartedEarly: "",
	roomSensorBlockTarget: "",
	roomSensorGapAboveTarget: "",
	roomSensorGapBelowTarget: "",
	roomSensorClimateTarget: "",
	roomSensorClimateTemperature: "",
	roomSensorCollapseClimate: "",
	roomSensorControl: "",
	roomSensorExpandClimate: "",
	roomSensorIntroDetail: "",
	roomSensorIntroTitle: "",
	roomSensorLiveStatus: "",
	roomSensorNoActiveBlock: "",
	roomSensorNoActiveBlockDetail: "",
	roomSensorNotConfigured: "",
	roomSensorRoomTemperature: "",
	roomSensorRemainingToTarget: "",
	roomSensorRemainingValue: "",
	roomSensorScheduledTarget: "",
	roomSensorSelectSensor: "",
	roomSensorStatusAssisting: "",
	roomSensorStatusBlocked: "",
	roomSensorStatusDisabled: "",
	roomSensorStatusHolding: "",
	roomSensorStatusIdle: "",
	roomSensorStatusNotConfigured: "",
	roomSensorStatusReady: "",
	roomSensorStatusUnavailable: "",
	roomSensorTemperatureEntity: "",
	roomSensorTemperatureEntityHelp: "",
	roomSensorTemperatureScale: "",
	roomSensorUnavailable: "",
	roomSensorValueUnavailable: "",
	save: "",
	saveTemplate: "",
	saved: "",
	saving: "",
	scheduleCopyHint: "",
	scheduleEditor: "",
	scheduleStepClimate: "",
	scheduleStepConfigure: "",
	scheduleStepDay: "",
	reorderZones: "",
	selectedWeekday: "",
	selectedZone: "",
	selectTemplatePlaceholder: "",
	selectTemplateToBegin: "",
	setTemperature: "",
	settings: "",
	settingsPanelIntro: "",
	startupBehavior: "",
	startsAt: "",
	applyScheduleOnStartup: "",
	applyScheduleOnStartupDescription: "",
	start: "",
	status: "",
	stop: "",
	supportedFanModes: "",
	supportedHorizontalSwingModes: "",
	supportedPresetModes: "",
	supportedSwingModes: "",
	presetMode: "",
	swingMode: "",
	temp: "",
	temperatureRange: "",
	temperatureUnit: "",
	temperatureUnitManagedByHomeAssistant: "",
	temperatureMigrationRequired: "",
	temperatureMigrationStopped: "",
	temperatureMigrationQuestion: "",
	temperatureMigrationExplanation: "",
	temperatureMigrationUse: "",
	temperatureMigrationConfirm: "",
	temperatureMigrationComplete: "",
	temperatureMigrationFailed: "",
	temperatureLegacyResetQuestion: "",
	temperatureLegacyResetExplanation: "",
	temperatureLegacyResetStopped: "",
	temperatureStep: "",
	temperatureStepNotReported: "",
	temperatureStepNotReportedDescription: "",
	targetTemp: "",
	targetHumidity: "",
	targetBy: "",
	targetTemperature: "",
	todayTimeline: "",
	updateTemplate: "",
	templateDeleted: "",
	templateNameRequired: "",
	templateOptionalHint: "",
	templateSaved: "",
	templates: "",
	thermostat: "",
	templatesPanelIntro: "",
	time: "",
	timeline: "",
	title: "",
	unableApplyThermostats: "",
	unableCopy: "",
	unableLoad: "",
	unablePause: "",
	unableResume: "",
	unableReset: "",
	unableSave: "",
	unableSaveSettings: "",
	unableDeleteTemplate: "",
	unableExport: "",
	unableSaveTemplate: "",
	unableSubscribe: "",
	unsupportedModeForClimate: "",
	unsaved: "",
	waiting: "",
	zoneOrder: "",
	zonesManaged: "",
	weekdays: {
		monday: "",
		tuesday: "",
		wednesday: "",
		thursday: "",
		friday: "",
		saturday: "",
		sunday: ""
	},
	schedulerStatuses: {
		idle: "",
		override_active: "",
		paused: "",
		scheduled: ""
	},
	schedulerModes: {
		auto: "",
		paused: ""
	},
	hvacModes: {
		auto: "",
		cool: "",
		dry: "",
		fan_only: "",
		heat: "",
		heat_cool: "",
		off: ""
	},
	hvacActions: {
		cooling: "",
		drying: "",
		fan: "",
		heating: "",
		idle: "",
		off: ""
	}
}, A = Object.fromEntries(Object.entries(/* @__PURE__ */ Object.assign({
	"./en.ts": et,
	"./es.ts": nt,
	"./template.ts": it,
	"./types.ts": /* @__PURE__ */ t({})
})).map(([e, t]) => {
	let n = e.match(/\.\/(.+)\.ts$/)?.[1] ?? "";
	return [n, t[n]];
}).filter(([e, t]) => !!(e && t && e !== "index" && e !== "template" && e !== "types")));
//#endregion
//#region src/velair/i18n.ts
function ot(e) {
	let t = e?.locale?.language ?? e?.language ?? e?.selectedLanguage ?? "en", n = String(t).toLowerCase();
	return Object.keys(A).find((e) => n === e || n.startsWith(`${e}-`)) ?? "en";
}
function st(e, t, n = {}) {
	let r = A[e][t] ?? A.en[t];
	if (typeof r != "string") return t;
	let i = r;
	return Object.entries(n).forEach(([e, t]) => {
		i = i.replaceAll(`{${e}}`, String(t));
	}), i;
}
function ct(e, t) {
	let n = A[e].weekdays, r = A.en.weekdays;
	return n[t] ?? r[t] ?? ft(t);
}
function lt(e, t) {
	return ct(e, t).slice(0, 3);
}
function ut(e, t, n) {
	let r = A[e][t], i = A.en[t];
	return r[n] ?? i[n] ?? dt(n);
}
function dt(e) {
	return e.split("_").filter(Boolean).map((e) => ft(e)).join(" ");
}
function ft(e) {
	return e && e[0].toUpperCase() + e.slice(1);
}
//#endregion
//#region src/velair/domain/climate.ts
function pt(e) {
	let t = e?.attributes;
	return JSON.stringify([
		e?.state ?? "",
		t?.current_temperature ?? null,
		t?.temperature ?? null,
		t?.hvac_action ?? "",
		t?.friendly_name ?? "",
		t?.unit_of_measurement ?? "",
		t?.hvac_modes ?? [],
		t?.min_temp ?? null,
		t?.max_temp ?? null,
		t?.target_temp_step ?? null,
		t?.fan_mode ?? null,
		t?.current_humidity ?? null,
		t?.humidity ?? null,
		t?.min_humidity ?? null,
		t?.max_humidity ?? null,
		t?.preset_mode ?? null,
		t?.preset_modes ?? [],
		t?.fan_modes ?? [],
		t?.swing_mode ?? null,
		t?.swing_modes ?? [],
		t?.swing_horizontal_mode ?? null,
		t?.swing_horizontal_modes ?? []
	]);
}
function mt(e) {
	return e.replaceAll("_", "-");
}
function ht(e, t) {
	let n = Dt(t) ? [41, 95] : [5, 35], r = Et(e?.attributes?.min_temp, n[0]), i = Et(e?.attributes?.max_temp, n[1]);
	return r >= i || Ot(r, i, t) ? n : [r, i];
}
function gt(e) {
	let t = Et(e?.attributes?.target_temp_step, NaN);
	return Number.isFinite(t) && t > 0 ? t : void 0;
}
function _t(e, t) {
	return t === void 0 || !Number.isFinite(t) || t <= 0 ? e : Math.round(Math.ceil(e / t - 1e-6) * t * 1e6) / 1e6;
}
function vt(e) {
	let t = e?.attributes?.hvac_modes;
	return Array.isArray(t) ? t.filter((e) => typeof e == "string") : [];
}
function yt(e) {
	return kt(e, "fan_modes");
}
function bt(e) {
	return kt(e, "preset_modes");
}
function xt(e) {
	return kt(e, "swing_modes");
}
function St(e) {
	return kt(e, "swing_horizontal_modes");
}
function Ct(e) {
	let t = Et(e?.attributes?.min_humidity, NaN), n = Et(e?.attributes?.max_humidity, NaN);
	if (!Number.isFinite(t) && !Number.isFinite(n) && typeof e?.attributes?.humidity != "number") return;
	let r = Number.isFinite(t) ? t : 0, i = Number.isFinite(n) ? n : 100;
	return r < i ? [r, i] : void 0;
}
function wt(e) {
	let t = new Set(e);
	return Ke.filter((e) => t.has(e));
}
function Tt(e) {
	let t = e?.attributes ?? {}, n = [];
	return typeof t.current_temperature == "number" && n.push({
		icon: "mdi:thermometer",
		labelKey: "currentTemperature"
	}), typeof t.temperature == "number" && n.push({
		icon: "mdi:thermostat",
		labelKey: "targetTemperature"
	}), (typeof t.current_humidity == "number" || typeof t.humidity == "number") && n.push({
		icon: "mdi:water-percent",
		labelKey: "currentHumidity"
	}), Array.isArray(t.preset_modes) && t.preset_modes.length && n.push({
		icon: "mdi:tune-variant",
		labelKey: "supportedPresetModes"
	}), Array.isArray(t.fan_modes) && t.fan_modes.length && n.push({
		icon: "mdi:fan",
		labelKey: "supportedFanModes"
	}), Array.isArray(t.swing_modes) && t.swing_modes.length && n.push({
		icon: "mdi:swap-vertical",
		labelKey: "supportedSwingModes"
	}), Array.isArray(t.swing_horizontal_modes) && t.swing_horizontal_modes.length && n.push({
		icon: "mdi:swap-horizontal",
		labelKey: "supportedHorizontalSwingModes"
	}), (typeof t.target_temp_low == "number" || typeof t.target_temp_high == "number") && n.push({
		icon: "mdi:thermometer-lines",
		labelKey: "temperatureRange"
	}), n;
}
function Et(e, t) {
	let n = Number(e);
	return Number.isFinite(n) ? n : t;
}
function Dt(e) {
	return String(e ?? "").toUpperCase().includes("F");
}
function Ot(e, t, n) {
	return Dt(n) ? t <= 60 && e < 40 : !!n && (t > 60 || e > 40);
}
function kt(e, t) {
	let n = e?.attributes?.[t];
	return Array.isArray(n) ? n.filter((e) => typeof e == "string") : [];
}
//#endregion
//#region src/velair/domain/settings.ts
function At(e) {
	let t = e.first_weekday ?? e.selected_weekday ?? "monday";
	return k.includes(t) ? t : "monday";
}
function jt(e) {
	let t = k.indexOf(e);
	return t <= 0 ? [...k] : [...k.slice(t), ...k.slice(0, t)];
}
function Mt(e, t = []) {
	let n = new Set(e), r = t.filter((e) => n.has(e)), i = e.filter((e) => !r.includes(e));
	return [...r, ...i];
}
function Nt(e, t) {
	let n = Mt(e, t.zone_order), r = t.entities?.filter(Boolean) ?? [];
	if (!r.length) return n;
	let i = new Set(r);
	return n.filter((e) => i.has(e));
}
function Pt(e) {
	return e.length ? [Math.min(...e.map(([e]) => e)), Math.max(...e.map(([, e]) => e))] : [5, 35];
}
function Ft(e) {
	let t = e.filter((e) => e !== void 0 && Number.isFinite(e) && e > 0);
	if (!(t.length !== e.length || !t.length)) return t.every((e) => Math.abs(e - t[0]) <= 1e-9) ? t[0] : void 0;
}
function It(e) {
	return e.toFixed(e % 1 == 0 ? 0 : 1);
}
function Lt(e, t, n) {
	let r = new Set(e);
	return n ? r.add(t) : r.delete(t), r;
}
//#endregion
//#region src/velair/controllers/card-context.ts
function j(e) {
	return e;
}
function Rt(e) {
	return e.currentTarget.value;
}
function zt(e) {
	return Ze.includes(e) || Qe.includes(e);
}
function Bt(e, t, n) {
	return zt(e) ? e : zt(n) ? n : zt(t) ? t : "overview-status";
}
function Vt(e, t, n) {
	if (!t) return !1;
	if (!n) return !0;
	let r = Nt(e._data?.configured_entities ?? [], e._config);
	return r.length ? r.some((e) => pt(t.states?.[e]) !== pt(n.states?.[e])) : !1;
}
function Ht(e, t, n) {
	if (!t || !n || !e._data) return !1;
	let r = new Set(Nt(e._data.configured_entities, e._config));
	return Object.entries(e._data.zones).some(([e, i]) => {
		if (!r.has(e)) return !1;
		let a = i.preconditioning;
		if (!a?.enabled && !a?.room_sensor_assist_enabled) return !1;
		if (Ut(t, e) !== Ut(n, e)) return !0;
		let o = Wt(t, e) !== Wt(n, e);
		if (a?.room_sensor_assist_enabled && o) return !0;
		let s = a?.room_temperature_entity_id;
		if (a?.room_sensor_assist_enabled && s && t.states?.[s]?.state !== n.states?.[s]?.state) return !0;
		let c = a.use_outdoor_temperature ? a.outdoor_temperature_entity_id : null;
		return !!(c && t.states?.[c]?.state !== n.states?.[c]?.state);
	});
}
function Ut(e, t) {
	return e.states?.[t]?.attributes?.current_temperature ?? null;
}
function Wt(e, t) {
	return e.states?.[t]?.attributes?.temperature ?? null;
}
function M(e) {
	return ot(e.hass);
}
function Gt(e, t, n = {}) {
	return st(M(e), t, n);
}
function Kt(e, t) {
	return ct(M(e), t);
}
function qt(e, t) {
	return lt(M(e), t);
}
function Jt(e, t, n) {
	return ut(M(e), t, n);
}
function Yt(e) {
	return At(e._config);
}
function Xt(e) {
	return jt(Yt(e));
}
function Zt(e, t) {
	return Mt(t, e._config.zone_order);
}
function Qt(e, t) {
	return Nt(t, e._config);
}
//#endregion
//#region src/velair/styles/base-styles.ts
var $t = u`
  :host {
    display: block;
    max-width: 100%;
    min-width: 0;
  }

  :host(.timeline-resizing),
  :host(.timeline-resizing) * {
    cursor: ew-resize !important;
  }

  .card {
    box-sizing: border-box;
    color: var(--primary-text-color);
    container-type: inline-size;
    max-width: 100%;
    min-width: 0;
    padding: 16px;
    position: relative;
  }

  .card-scrim {
    -webkit-backdrop-filter: grayscale(0.85) saturate(0.55) brightness(0.72) blur(1px);
    backdrop-filter: grayscale(0.85) saturate(0.55) brightness(0.72) blur(1px);
    background: color-mix(in srgb, var(--primary-background-color, #000) 58%, transparent);
    border: 0;
    border-radius: var(--ha-card-border-radius, 12px);
    bottom: 0;
    cursor: default;
    left: 0;
    padding: 0;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 1;
  }

  .header,
  .event,
  .section-title,
  .editor-header,
  .copy-header,
  .editor-actions,
  .title-actions {
    align-items: center;
    display: flex;
    gap: 12px;
    justify-content: space-between;
  }

  .title-actions {
    justify-content: flex-end;
    margin-top: 10px;
  }

  .section-heading {
    align-items: center;
    display: grid;
    gap: 10px;
    grid-template-columns: 28px minmax(0, 1fr);
    min-width: 0;
  }

  .section-heading ha-icon {
    --mdc-icon-size: 20px;
    color: var(--primary-color);
    justify-self: center;
  }

  .section-heading .section-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .section-label {
    color: var(--primary-text-color);
    display: block;
    font-weight: 600;
  }

  h2,
  h3,
  p {
    margin: 0;
  }

  h2 {
    font-size: 20px;
    font-weight: 600;
  }

  h3 {
    font-size: 16px;
    font-weight: 600;
  }

  .subtle,
  .label,
  .empty,
  .event span {
    color: var(--secondary-text-color);
    font-size: 12px;
  }

  .icon-button,
  .command-button {
    align-items: center;
    background: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    color: var(--primary-text-color);
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
  }

  .icon-button {
    height: 40px;
    width: 40px;
  }

  .command-button {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--text-primary-color);
    flex: 0 1 auto;
    gap: 8px;
    min-width: 0;
    min-height: 40px;
    padding: 8px 12px;
  }

  .command-button span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .editor-actions {
    flex-wrap: wrap;
    justify-content: flex-end;
  }

  .command-button.primary {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--text-primary-color);
  }

  .command-button.success {
    background: var(--success-color, #2e7d32);
    border-color: var(--success-color, #2e7d32);
    color: var(--text-primary-color);
  }

  .icon-button.success {
    background: var(--success-color, #2e7d32);
    border-color: var(--success-color, #2e7d32);
    color: var(--text-primary-color);
  }

  .icon-button.primary {
    background: var(--primary-color);
    border-color: var(--primary-color);
    color: var(--text-primary-color);
  }

  .command-button.warning {
    background: color-mix(in srgb, var(--warning-color, #f9a825) 16%, var(--card-background-color));
    border-color: color-mix(in srgb, var(--warning-color, #f9a825) 55%, var(--divider-color));
    color: var(--primary-text-color);
  }

  .command-button:disabled {
    cursor: default;
    opacity: 0.55;
  }

  .icon-button:disabled {
    cursor: default;
    opacity: 0.55;
  }

  .icon-button.danger {
    background: var(--error-color, #c62828);
    border-color: var(--error-color, #c62828);
  }

  .command-button.danger {
    background: var(--error-color, #c62828);
    border-color: var(--error-color, #c62828);
  }

  .icon-button.danger,
  .command-button.danger {
    color: var(--text-primary-color);
  }

  .command-button.compact {
    min-height: 34px;
    padding: 6px 10px;
  }
`, en = u`
.comfort-view {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.comfort-intro {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: 24px minmax(0, 1fr);
  padding: 2px 4px 4px;
}

.comfort-intro > ha-icon {
  --mdc-icon-size: 22px;
  color: var(--primary-color);
}

.comfort-intro > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.comfort-intro strong {
  color: var(--primary-text-color);
  font-size: 14px;
  line-height: 1.25;
}

.comfort-intro small {
  color: var(--secondary-text-color);
  font-size: 12px;
  line-height: 1.35;
}

.comfort-zone {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  min-width: 0;
  overflow: visible;
  position: relative;
}

.comfort-zone-heading {
  align-items: center;
  background: var(--card-background-color);
  border-bottom: 1px solid var(--divider-color);
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  padding: 12px;
}

.comfort-zone.collapsed .comfort-zone-heading {
  border-bottom: 0;
  border-radius: 8px;
}

.comfort-zone-toggle {
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 8px;
  grid-template-columns: 20px minmax(0, 1fr);
  min-width: 0;
  padding: 0;
  text-align: left;
}

.comfort-zone-toggle:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 4px;
}

.comfort-zone-toggle:disabled {
  cursor: default;
}

.comfort-zone-toggle:disabled .comfort-expand-icon {
  color: var(--disabled-text-color);
  opacity: 0.45;
}

.comfort-expand-icon {
  color: var(--secondary-text-color);
}

.comfort-zone-toggle > ha-icon {
  --mdc-icon-size: 20px;
}

.comfort-zone-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
  text-align: left;
}

.comfort-zone-identity strong,
.comfort-zone-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comfort-zone-identity strong {
  color: var(--primary-text-color);
  font-size: 14px;
}

.comfort-zone-identity span {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.comfort-zone-actions {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  justify-content: flex-end;
  min-width: 0;
}

.comfort-assessment-summary {
  align-items: center;
  display: flex;
  justify-content: flex-end;
  min-width: 0;
}

.comfort-assessment-line {
  align-items: center;
  display: flex;
  gap: 6px;
}

.comfort-condition-pill {
  border-radius: 999px;
  border: 1px solid var(--divider-color);
  color: var(--secondary-text-color);
  font-size: 0.76rem;
  font-weight: 700;
  padding: 4px 8px;
  white-space: nowrap;
}

.comfort-condition-pill.condition-comfortable,
.comfort-condition-pill.condition-temperature_comfortable,
.comfort-condition-pill.condition-humidity_comfortable,
.comfort-air-pill.air-good {
  border-color: color-mix(in srgb, var(--success-color, #43a047) 28%, var(--divider-color));
  color: var(--success-color, #43a047);
}

.comfort-condition-pill.condition-dry,
.comfort-condition-pill.condition-humid,
.comfort-condition-pill.condition-cold_and_dry,
.comfort-condition-pill.condition-cold_and_humid,
.comfort-condition-pill.condition-hot_and_dry,
.comfort-condition-pill.condition-hot_and_humid,
.comfort-air-pill.air-elevated {
  border-color: color-mix(in srgb, var(--warning-color, #f9ab00) 35%, var(--divider-color));
  color: var(--warning-color, #b26a00);
}

.comfort-condition-pill.condition-hot,
.comfort-air-pill.air-poor {
  border-color: color-mix(in srgb, var(--error-color, #d93025) 32%, var(--divider-color));
  color: var(--error-color, #d93025);
}

.comfort-condition-pill.condition-cold {
  border-color: color-mix(in srgb, var(--info-color, #039be5) 35%, var(--divider-color));
  color: var(--info-color, #0277bd);
}

.comfort-air-pill {
  border: 1px solid var(--divider-color);
  border-radius: 999px;
  color: var(--secondary-text-color);
  font-size: 0.76rem;
  font-weight: 700;
  padding: 4px 8px;
  white-space: nowrap;
}

.comfort-zone-content {
  border-top: 1px solid var(--divider-color);
  display: grid;
  gap: 12px;
  padding: 12px;
}

.comfort-assessment-card,
.comfort-config-section {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  padding: 12px;
}

.comfort-assessment-card.idle {
  align-items: center;
  color: var(--secondary-text-color);
  display: flex;
  gap: 10px;
}

.comfort-assessment-heading {
  align-items: start;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  margin-bottom: 10px;
}

.comfort-assessment-heading > span {
  align-items: center;
  display: flex;
  gap: 6px;
}

.comfort-data-warning {
  align-items: center;
  color: var(--warning-color, #b26a00);
  cursor: help;
  display: inline-flex;
  position: relative;
}

.comfort-data-warning ha-icon {
  --mdc-icon-size: 17px;
}

.comfort-data-warning:hover .comfort-help-tooltip,
.comfort-data-warning:focus .comfort-help-tooltip,
.comfort-data-warning:focus-visible .comfort-help-tooltip {
  display: block;
}

.comfort-data-warning .comfort-help-tooltip {
  left: auto;
  max-width: min(260px, calc(100vw - 32px));
  overflow-wrap: anywhere;
  right: 0;
  text-align: left;
  transform: none;
  white-space: normal;
}

.comfort-visuals {
  display: grid;
  gap: 12px;
}

.comfort-map {
  display: grid;
  gap: 5px 8px;
  grid-template-columns: 64px minmax(0, 1fr);
  grid-template-rows: minmax(180px, 24vh) auto auto;
  min-width: 0;
}

.comfort-map-plot {
  background:
    linear-gradient(
      to bottom,
      color-mix(in srgb, var(--primary-color) 14%, transparent) 0%,
      transparent 42%,
      transparent 58%,
      color-mix(in srgb, var(--warning-color, #f9ab00) 14%, transparent) 100%
    ),
    linear-gradient(
      to right,
      color-mix(in srgb, var(--info-color, #039be5) 15%, transparent) 0%,
      transparent 42%,
      transparent 58%,
      color-mix(in srgb, var(--error-color, #d93025) 13%, transparent) 100%
    ),
    var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  min-height: 180px;
  overflow: hidden;
  position: relative;
}

.comfort-map-plot::before,
.comfort-map-plot::after {
  background: var(--divider-color);
  content: "";
  opacity: 0.65;
  pointer-events: none;
  position: absolute;
}

.comfort-map-plot::before {
  height: 1px;
  left: 0;
  right: 0;
  top: 50%;
}

.comfort-map-plot::after {
  bottom: 0;
  left: 50%;
  top: 0;
  width: 1px;
}

.comfort-map-zone {
  background: color-mix(in srgb, var(--success-color, #43a047) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--success-color, #43a047) 48%, var(--divider-color));
  border-radius: 5px;
  box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--success-color, #43a047) 9%, transparent);
  inset: 33.333%;
  position: absolute;
  z-index: 1;
}

.comfort-map-regions {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  grid-template-rows: repeat(3, 1fr);
  inset: 0;
  position: absolute;
}

.comfort-map-regions > span {
  border: 1px solid color-mix(in srgb, var(--divider-color) 34%, transparent);
}

.comfort-map-marker {
  height: 12px;
  left: var(--comfort-x);
  position: absolute;
  top: var(--comfort-y);
  width: 12px;
  z-index: 3;
}

.comfort-map-marker-dot {
  background: var(--card-background-color);
  border: 2px solid var(--primary-text-color);
  border-radius: 50%;
  box-shadow:
    0 0 0 2px var(--card-background-color),
    0 1px 5px rgba(0, 0, 0, 0.32);
  display: block;
  height: 12px;
  position: absolute;
  transform: translate(-50%, -50%);
  width: 12px;
}

.comfort-map-marker-dot::after,
.comfort-scale-marker::after,
.comfort-legend-current::after {
  background: var(--primary-color);
  border-radius: 50%;
  content: "";
  inset: 3px;
  position: absolute;
}

.comfort-map-marker-label {
  align-items: center;
  background: var(--card-background-color);
  border: 1px solid color-mix(in srgb, var(--primary-color) 45%, var(--divider-color));
  border-radius: 5px;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.16);
  color: var(--primary-text-color);
  display: flex;
  gap: 5px;
  left: 0;
  padding: 4px 6px;
  position: absolute;
  bottom: 20px;
  transform: translateX(-50%);
  white-space: nowrap;
  z-index: 2;
}

.comfort-map-marker-label::after {
  border-left: 4px solid transparent;
  border-right: 4px solid transparent;
  border-top: 5px solid var(--card-background-color);
  content: "";
  left: 50%;
  position: absolute;
  top: 100%;
  transform: translateX(-50%);
}

.comfort-map-marker.label-below .comfort-map-marker-label {
  bottom: auto;
  top: 20px;
}

.comfort-map-marker.label-below .comfort-map-marker-label::after {
  border-bottom: 5px solid var(--card-background-color);
  border-top: 0;
  bottom: 100%;
  top: auto;
}

.comfort-map-marker.label-left .comfort-map-marker-label {
  transform: translateX(-8px);
}

.comfort-map-marker.label-left .comfort-map-marker-label::after {
  left: 8px;
}

.comfort-map-marker.label-right .comfort-map-marker-label {
  left: auto;
  right: 8px;
  transform: none;
}

.comfort-map-marker.label-right .comfort-map-marker-label::after {
  left: auto;
  right: 0;
}

.comfort-map-marker-label strong {
  font-size: 0.78rem;
}

.comfort-map-marker-label small {
  color: var(--secondary-text-color);
  font-size: 0.72rem;
}

.comfort-map-axis {
  color: var(--secondary-text-color);
  display: flex;
  font-size: 0.7rem;
  justify-content: space-between;
}

.comfort-map-axis-y {
  align-items: flex-end;
  flex-direction: column;
  grid-column: 1;
  grid-row: 1;
  text-align: right;
}

.comfort-map-axis-x {
  grid-column: 2;
  grid-row: 2;
}

.comfort-map-legend {
  align-items: center;
  color: var(--secondary-text-color);
  display: flex;
  flex-wrap: wrap;
  font-size: 0.7rem;
  gap: 5px 14px;
  grid-column: 2;
  grid-row: 3;
  justify-content: center;
  padding-top: 2px;
  text-align: center;
}

.comfort-map-legend > span {
  align-items: center;
  display: inline-flex;
  gap: 6px;
}

.comfort-legend-zone {
  background: color-mix(in srgb, var(--success-color, #43a047) 7%, transparent);
  border: 1px solid color-mix(in srgb, var(--success-color, #43a047) 48%, var(--divider-color));
  border-radius: 3px;
  box-sizing: border-box;
  display: inline-block;
  height: 10px;
  width: 14px;
}

.comfort-legend-current {
  background: var(--card-background-color);
  border: 2px solid var(--primary-text-color);
  border-radius: 50%;
  box-shadow: 0 0 0 1px var(--card-background-color);
  box-sizing: border-box;
  display: inline-block;
  height: 12px;
  position: relative;
  width: 12px;
}

.comfort-range-scale,
.comfort-co2-scale {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  padding: 12px;
}

.comfort-range-scale header,
.comfort-co2-scale header {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
}

.comfort-range-scale header span,
.comfort-co2-scale header span {
  color: var(--secondary-text-color);
  font-size: 0.78rem;
  font-weight: 700;
}

.comfort-scale-track,
.comfort-co2-track {
  border-radius: 999px;
  height: 10px;
  position: relative;
}

.comfort-range-scale.metric-temperature .comfort-scale-track {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--info-color, #039be5) 72%, var(--divider-color)) 0%,
    color-mix(in srgb, var(--info-color, #039be5) 72%, var(--divider-color)) 30%,
    var(--success-color, #43a047) 36%,
    var(--success-color, #43a047) 64%,
    color-mix(in srgb, var(--error-color, #d93025) 66%, var(--divider-color)) 70%,
    color-mix(in srgb, var(--error-color, #d93025) 66%, var(--divider-color)) 100%
  );
}

.comfort-range-scale.metric-humidity .comfort-scale-track {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--warning-color, #f9ab00) 74%, var(--divider-color)) 0%,
    color-mix(in srgb, var(--warning-color, #f9ab00) 74%, var(--divider-color)) 30%,
    var(--success-color, #43a047) 36%,
    var(--success-color, #43a047) 64%,
    color-mix(in srgb, var(--primary-color) 62%, var(--divider-color)) 70%,
    color-mix(in srgb, var(--primary-color) 62%, var(--divider-color)) 100%
  );
}

.comfort-scale-marker {
  background: var(--card-background-color);
  border: 2px solid var(--primary-text-color);
  border-radius: 50%;
  box-shadow:
    0 0 0 2px var(--card-background-color),
    0 1px 4px rgba(0, 0, 0, 0.35);
  height: 14px;
  left: var(--comfort-position);
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  width: 14px;
  z-index: 2;
}

.comfort-range-limits,
.comfort-co2-scale footer {
  color: var(--secondary-text-color);
  font-size: 0.7rem;
}

.comfort-range-limits {
  min-height: 1em;
  position: relative;
}

.comfort-range-limits span {
  position: absolute;
  transform: translateX(-50%);
  white-space: nowrap;
}

.comfort-range-limits span:first-child {
  left: 33.333%;
}

.comfort-range-limits span:last-child {
  left: 66.666%;
}

.comfort-co2-scale footer {
  display: flex;
  justify-content: space-between;
}

.comfort-co2-track {
  background: linear-gradient(
    90deg,
    color-mix(in srgb, var(--success-color, #43a047) 70%, var(--divider-color)) 0%,
    color-mix(in srgb, var(--success-color, #43a047) 70%, var(--divider-color)) calc(var(--comfort-attention) - 3%),
    var(--warning-color, #f9ab00) calc(var(--comfort-attention) + 3%),
    var(--warning-color, #f9ab00) calc(var(--comfort-poor) - 3%),
    var(--error-color, #d93025) calc(var(--comfort-poor) + 3%),
    var(--error-color, #d93025) 100%
  );
  overflow: visible;
}

.comfort-no-readings {
  align-items: center;
  background: var(--card-background-color);
  border: 1px dashed var(--divider-color);
  border-radius: 8px;
  color: var(--secondary-text-color);
  display: flex;
  gap: 8px;
  justify-content: center;
  min-height: 96px;
  padding: 12px;
}

.comfort-no-readings ha-icon {
  --mdc-icon-size: 20px;
}

.comfort-config-section h3 {
  align-items: center;
  display: flex;
  font-size: 0.9rem;
  gap: 6px;
  margin: 0 0 10px;
}

.comfort-config-section h3 ha-icon {
  color: var(--primary-color);
}

.comfort-config-rows {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
}

.comfort-config-row {
  align-items: start;
  display: grid;
  gap: 6px;
  min-width: 0;
}

.comfort-config-label {
  align-items: center;
  color: var(--secondary-text-color);
  display: flex;
  font-size: 0.78rem;
  font-weight: 700;
  gap: 5px;
}

.comfort-help {
  align-items: center;
  cursor: help;
  display: inline-flex;
  position: relative;
}

.comfort-help ha-icon {
  --mdc-icon-size: 16px;
}

.comfort-help-tooltip {
  background: var(--primary-text-color);
  border-radius: 6px;
  bottom: calc(100% + 8px);
  box-sizing: border-box;
  color: var(--card-background-color);
  display: none;
  font-size: 0.76rem;
  font-weight: 500;
  left: auto;
  line-height: 1.35;
  max-width: min(260px, calc(100vw - 32px));
  overflow-wrap: anywhere;
  padding: 7px 9px;
  position: absolute;
  right: 0;
  text-align: left;
  transform: none;
  white-space: normal;
  width: max-content;
  z-index: 20;
}

.comfort-help:hover .comfort-help-tooltip,
.comfort-help:focus .comfort-help-tooltip,
.comfort-help:focus-visible .comfort-help-tooltip {
  display: block;
}

.comfort-selected-entity {
  color: var(--secondary-text-color);
  display: block;
  min-height: 1.15rem;
  margin-top: 3px;
  max-width: 100%;
  min-width: 0;
  overflow: hidden;
  padding-left: 1px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.comfort-select-wrap {
  display: grid;
  min-width: 0;
}

.comfort-select-wrap::after,
.comfort-select-wrap:has(select:open)::after {
  display: none;
}

.comfort-select-control {
  display: block;
  min-width: 0;
  position: relative;
}

.comfort-select-control select {
  width: 100%;
}

.comfort-select-control::after {
  border: solid var(--secondary-text-color);
  border-radius: 1px;
  border-width: 0 2px 2px 0;
  content: "";
  height: 7px;
  pointer-events: none;
  position: absolute;
  right: 11px;
  top: 50%;
  transform: translateY(-62%) rotate(45deg);
  transition: transform 120ms ease;
  width: 7px;
}

.comfort-select-control:has(select:open)::after {
  transform: translateY(-28%) rotate(225deg);
}

.comfort-number-pair,
.comfort-number-single {
  align-items: center;
  display: flex;
  gap: 6px;
}

.comfort-number-pair {
  align-items: end;
}

.comfort-number-separator {
  align-items: center;
  align-self: end;
  color: var(--secondary-text-color);
  display: inline-flex;
  height: 34px;
  justify-content: center;
}

.comfort-number-field {
  display: grid;
  gap: 3px;
}

.comfort-number-field small,
.comfort-number-unit,
.comfort-number-single-unit {
  color: var(--secondary-text-color);
  font-size: 0.78rem;
  font-weight: 700;
}

.comfort-number-unit,
.comfort-number-single-unit {
  align-items: center;
  align-self: end;
  display: inline-flex;
  min-height: 34px;
}

.comfort-number-pair input,
.comfort-number-single input {
  min-width: 0;
  width: 76px;
}

.comfort-number-single .comfort-number-field {
  flex: 0 0 auto;
}

@media (min-width: 681px) {
  .comfort-metric-config-section .comfort-config-rows {
    align-items: start;
    column-gap: 24px;
    grid-template-columns: repeat(auto-fit, minmax(min(100%, 300px), 1fr));
    row-gap: 8px;
  }

  .comfort-metric-config-section .comfort-number-pair {
    align-items: center;
    flex-wrap: wrap;
    min-height: 34px;
    min-width: 0;
  }

  .comfort-metric-config-section .comfort-number-field {
    align-items: center;
    display: flex;
    gap: 6px;
    min-width: 0;
  }

  .comfort-metric-config-section .comfort-number-field small {
    flex: 0 0 auto;
  }

  .comfort-metric-config-section .comfort-number-separator,
  .comfort-metric-config-section .comfort-number-unit {
    align-self: center;
  }
}

@media (max-width: 680px) {
  .comfort-zone-heading {
    align-items: center;
  }

  .comfort-assessment-heading {
    display: grid;
  }

  .comfort-zone-actions {
    gap: 5px;
  }

  .comfort-assessment-line {
    gap: 4px;
  }

  .comfort-air-pill,
  .comfort-condition-pill {
    max-width: 130px;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .comfort-map {
    grid-template-columns: 58px minmax(0, 1fr);
    grid-template-rows: 180px auto auto;
  }

  .comfort-config-rows {
    grid-template-columns: 1fr;
  }

  .comfort-config-row,
  .comfort-number-pair,
  .comfort-number-single {
    width: 100%;
  }

  .comfort-number-field {
    flex: 1 1 0;
  }

  .comfort-number-pair input,
  .comfort-number-single input {
    width: 100%;
  }
}
`, tn = u`
  .notice {
    align-items: center;
    animation: velair-notice-in 180ms ease-out;
    background: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    bottom: 16px;
    box-shadow: var(--ha-card-box-shadow, 0 4px 18px rgba(0, 0, 0, 0.18));
    box-sizing: border-box;
    display: flex;
    gap: 10px;
    justify-content: space-between;
    left: 50%;
    margin: 0;
    max-width: min(520px, calc(100vw - 32px));
    min-width: min(320px, calc(100vw - 32px));
    overflow: hidden;
    padding: 12px;
    position: fixed;
    transform: translateX(-50%);
    width: max-content;
    z-index: 1000;
  }

  .notice-close {
    align-items: center;
    background: transparent;
    border: 0;
    color: currentColor;
    cursor: pointer;
    display: inline-flex;
    flex: 0 0 auto;
    height: 28px;
    justify-content: center;
    padding: 0;
    width: 28px;
  }

  .notice-close ha-icon {
    --mdc-icon-size: 18px;
  }

  .notice.error {
    background: color-mix(in srgb, var(--error-color) 12%, transparent);
    border-color: var(--error-color);
    bottom: 76px;
  }

  .notice.success {
    background: color-mix(in srgb, var(--success-color) 12%, transparent);
    border-color: var(--success-color);
    padding-bottom: 16px;
  }

  .notice-progress-track {
    background: color-mix(in srgb, var(--success-color, #2e7d32) 16%, var(--card-background-color));
    bottom: 0;
    height: 4px;
    left: 0;
    position: absolute;
    right: 0;
  }

  .notice-progress-fill {
    background: var(--success-color, #2e7d32);
    height: 100%;
    transition: width 500ms linear;
  }

  @keyframes velair-notice-in {
    from {
      opacity: 0;
      transform: translate(-50%, 14px);
    }

    to {
      opacity: 1;
      transform: translate(-50%, 0);
    }
  }
`, nn = u`
.overview-summary {
  margin: 0;
}

.overview-status-card {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 12px;
  padding: 14px;
}

.overview-status-card.status-running {
  border-color: color-mix(in srgb, var(--success-color, #2e7d32) 38%, var(--divider-color));
}

.overview-status-card.status-paused {
  border-color: color-mix(in srgb, var(--warning-color, #f9a825) 58%, var(--divider-color));
}

.overview-status-card.status-stopped {
  border-color: color-mix(in srgb, var(--error-color, #c62828) 54%, var(--divider-color));
}

.overview-status-heading {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.overview-scheduler-state {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.overview-scheduler-state strong {
  font-size: 18px;
  line-height: 1.2;
}

.overview-state-value {
  align-items: center;
  display: inline-flex;
  gap: 6px;
  min-width: 0;
}

.overview-state-value ha-icon {
  --mdc-icon-size: 20px;
  flex: 0 0 auto;
}

.overview-state-value.running ha-icon {
  color: var(--success-color, #2e7d32);
}

.overview-state-value.paused ha-icon {
  color: var(--warning-color, #f9a825);
}

.overview-state-value.stopped ha-icon {
  color: var(--error-color, #c62828);
}

.overview-scheduler-detail {
  color: var(--secondary-text-color);
  font-size: 13px;
  grid-column: 1 / -1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-status-card .pause-progress {
  border-radius: 0;
  position: static;
}

.overview-status-card .pause-progress span {
  padding: 0 0 2px;
}

.overview-controls {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: end;
  justify-self: end;
  max-width: 100%;
}

.overview-pause-control {
  display: grid;
  width: fit-content;
}

.overview-pause-input {
  --overview-pause-digits: 6ch;
  align-items: stretch;
  background: var(--card-background-color);
  border: 1px solid #c99500;
  border-radius: 8px;
  display: grid;
  grid-template-columns: calc(var(--overview-pause-digits) + 18px) 28px 34px;
  height: 36px;
  width: fit-content;
}

.overview-pause-input input {
  background: transparent;
  border: 0;
  box-sizing: border-box;
  color: var(--primary-text-color);
  font: inherit;
  font-size: 14px;
  height: 100%;
  margin-top: 0;
  min-width: 0;
  padding: 0 8px;
  width: calc(var(--overview-pause-digits) + 18px);
}

.overview-pause-input input:focus {
  outline: 2px solid var(--primary-color);
  outline-offset: -2px;
}

.overview-pause-unit {
  align-items: center;
  color: var(--secondary-text-color);
  display: inline-flex;
  font-size: 12px;
  justify-content: center;
}

.overview-inline-button {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  color: var(--primary-text-color);
  cursor: pointer;
  display: inline-flex;
  font: inherit;
  height: 36px;
  justify-content: center;
  min-width: 36px;
  padding: 0;
  white-space: nowrap;
}

.overview-pause-input .overview-inline-button {
  border-block: 0;
  border-inline-end: 0;
  border-inline-start: 0;
  border-radius: 0;
  border-top-right-radius: 7px;
  border-bottom-right-radius: 7px;
  height: 100%;
  min-width: 34px;
}

.overview-inline-button.warning {
  background: #c99500;
  border-color: #c99500;
  color: var(--text-primary-color);
}

.overview-inline-button.resume {
  background: var(--primary-color);
  border-color: var(--primary-color);
  color: var(--text-primary-color);
}

.overview-inline-button.danger {
  background: var(--error-color, #c62828);
  border-color: var(--error-color, #c62828);
  color: var(--text-primary-color);
}

.overview-inline-button:disabled {
  cursor: default;
  opacity: 0.55;
}

.overview-boost-panel {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 14px;
  margin-top: 14px;
  min-width: 0;
  padding: 12px;
}

.overview-boost-list {
  display: grid;
  gap: 8px;
  grid-template-columns: 1fr;
}

.overview-muted {
  color: var(--secondary-text-color);
  font-size: 13px;
}

.overview-empty-state {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: 28px minmax(0, 1fr);
  min-width: 0;
}

.overview-empty-state > ha-icon {
  --mdc-icon-size: 20px;
  color: var(--primary-color);
  justify-self: center;
}

.overview-empty-copy {
  display: grid;
  gap: 3px;
  min-width: 0;
}

.overview-climate-name {
  font-size: 14px;
  font-weight: 700;
  line-height: 1.2;
}

.overview-timeline-panel {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  isolation: isolate;
  margin-top: 14px;
  min-width: 0;
  padding: 12px;
  position: relative;
  z-index: 0;
}

.overview-timeline-scroll {
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 8px;
  position: relative;
  scrollbar-gutter: stable;
}

.overview-timeline-layout {
  --overview-timeline-name-column: 168px;
  display: grid;
  grid-template-columns: var(--overview-timeline-name-column) minmax(480px, 1fr);
  min-width: calc(var(--overview-timeline-name-column) + 480px);
}

.overview-timeline-names,
.overview-timeline-rows {
  display: grid;
  gap: 8px;
  grid-auto-rows: 34px;
  min-width: 0;
}

.overview-timeline-names {
  background: var(--secondary-background-color);
  left: 0;
  padding-right: 8px;
  position: sticky;
  z-index: 7;
}

.overview-timeline-axis,
.overview-timeline-axis-spacer {
  min-height: 22px;
}

.overview-timeline-axis-spacer {
  grid-row: 1;
}

.overview-timeline-axis {
  color: var(--secondary-text-color);
  font-size: 11px;
  position: relative;
}

.overview-timeline-axis > span {
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 1;
}

.overview-timeline-axis > span:nth-of-type(1) {
  left: 0;
  transform: translateY(-50%);
}

.overview-timeline-axis > span:nth-of-type(2) {
  left: 25%;
}

.overview-timeline-axis > span:nth-of-type(3) {
  left: 50%;
}

.overview-timeline-axis > span:nth-of-type(4) {
  left: 75%;
}

.overview-timeline-axis > span:nth-of-type(5) {
  left: 100%;
  transform: translate(-100%, -50%);
}

.overview-timeline-now-label {
  background: color-mix(in srgb, var(--card-background-color) 84%, var(--primary-color) 16%);
  border: 1px solid color-mix(in srgb, var(--primary-color) 58%, var(--divider-color));
  border-radius: 999px;
  color: var(--primary-text-color);
  font-size: 10px;
  font-weight: 600;
  left: clamp(26px, var(--overview-now-left), calc(100% - 26px));
  line-height: 1;
  padding: 2px 5px;
  position: absolute;
  top: 50%;
  transform: translate(-50%, -50%);
  white-space: nowrap;
  z-index: 3;
}

.overview-timeline-rows {
  position: relative;
}

.overview-timeline-now-line {
  bottom: 0;
  left: var(--overview-now-left);
  pointer-events: none;
  position: absolute;
  top: 22px;
  transform: translateX(-50%);
  width: 2px;
  z-index: 2;
}

.overview-timeline-now-line::before {
  background: color-mix(in srgb, var(--primary-color) 76%, var(--card-background-color));
  border-radius: 999px;
  bottom: 0;
  content: "";
  left: 0;
  position: absolute;
  top: 0;
  width: 2px;
}

.overview-timeline-name {
  align-items: center;
  background: var(--secondary-background-color);
  border-bottom: 1px solid var(--divider-color);
  display: flex;
  gap: 6px;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-timeline-name span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.overview-timeline-name ha-icon {
  --mdc-icon-size: 16px;
  color: var(--secondary-text-color);
  flex: 0 0 auto;
}

.overview-timeline-name.paused {
  color: var(--secondary-text-color);
}

.overview-timeline-name.paused ha-icon {
  color: var(--warning-color, #c99500);
}

.overview-timeline-track {
  background:
    linear-gradient(to right, var(--divider-color) 1px, transparent 1px) 0 0 / 25% 100%,
    var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  min-width: 0;
  overflow: visible;
  position: relative;
}

.overview-timeline-track.paused-indefinite .overview-timeline-block,
.overview-timeline-track.paused-indefinite .overview-timeline-boost {
  filter: grayscale(0.9) saturate(0.35);
}

.overview-timeline-block {
  align-items: center;
  background: var(--timeline-bg, color-mix(in srgb, var(--primary-color) 20%, var(--card-background-color)));
  border: 1px solid var(--timeline-border, color-mix(in srgb, var(--primary-color) 48%, var(--divider-color)));
  border-radius: 8px;
  bottom: 0;
  box-sizing: border-box;
  color: var(--primary-text-color);
  cursor: pointer;
  display: flex;
  min-width: 0;
  overflow: hidden;
  padding: 0 7px;
  position: absolute;
  text-align: left;
  top: 0;
  z-index: 3;
}

.overview-timeline-pause {
  align-items: center;
  background:
    linear-gradient(
      135deg,
      color-mix(in srgb, var(--card-background-color) 84%, var(--secondary-text-color) 16%) 0%,
      color-mix(in srgb, var(--card-background-color) 84%, var(--secondary-text-color) 16%) 42%,
      color-mix(in srgb, var(--card-background-color) 70%, var(--secondary-text-color) 30%) 42%,
      color-mix(in srgb, var(--card-background-color) 70%, var(--secondary-text-color) 30%) 58%,
      color-mix(in srgb, var(--card-background-color) 84%, var(--secondary-text-color) 16%) 58%,
      color-mix(in srgb, var(--card-background-color) 84%, var(--secondary-text-color) 16%) 100%
    ) 0 0 / 14px 14px,
    color-mix(in srgb, var(--card-background-color) 74%, var(--secondary-text-color) 26%);
  border: 1px solid color-mix(in srgb, var(--secondary-text-color) 58%, var(--divider-color));
  border-radius: 8px;
  bottom: 0;
  box-sizing: border-box;
  color: var(--primary-text-color);
  cursor: pointer;
  display: flex;
  justify-content: center;
  min-width: 0;
  overflow: hidden;
  padding: 0 7px;
  position: absolute;
  text-align: center;
  top: 0;
  z-index: 5;
}

.overview-timeline-pause.indefinite {
  border-style: dashed;
}

.overview-timeline-pause ha-icon {
  --mdc-icon-size: 13px;
  color: var(--warning-color, #c99500);
  flex: 0 0 auto;
}

.overview-timeline-boost {
  align-items: center;
  background: color-mix(in srgb, var(--timeline-handle, var(--primary-color)) 12%, var(--card-background-color));
  border: 2px solid color-mix(in srgb, var(--timeline-handle, var(--primary-color)) 86%, var(--card-background-color));
  border-radius: 8px;
  bottom: 0;
  box-shadow:
    0 0 0 1px color-mix(in srgb, var(--card-background-color) 70%, transparent),
    0 0 10px color-mix(in srgb, var(--timeline-handle, var(--primary-color)) 28%, transparent);
  box-sizing: border-box;
  color: var(--primary-text-color);
  cursor: pointer;
  display: flex;
  isolation: isolate;
  min-width: 0;
  overflow: hidden;
  padding: 0 7px;
  position: absolute;
  text-align: left;
  top: 0;
  z-index: 4;
}

.overview-timeline-boost::before,
.overview-timeline-boost::after {
  animation: velair-overview-boost-bars 4.8s linear infinite;
  background:
    linear-gradient(
      110deg,
      transparent 0%,
      color-mix(in srgb, var(--timeline-handle, var(--primary-color)) 18%, transparent) 28%,
      color-mix(in srgb, var(--timeline-handle, var(--primary-color)) 58%, transparent) 50%,
      color-mix(in srgb, var(--timeline-handle, var(--primary-color)) 18%, transparent) 72%,
      transparent 100%
    );
  content: "";
  inset: -1px auto -1px 0;
  opacity: 0;
  pointer-events: none;
  position: absolute;
  width: 42%;
  z-index: -1;
}

.overview-timeline-boost::after {
  animation-delay: -2.4s;
}

.overview-timeline-boost ha-icon {
  --mdc-icon-size: 13px;
  color: var(--timeline-handle, var(--primary-color));
  flex: 0 0 auto;
}

.overview-timeline-block-main {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 0 4px;
  line-height: 1.1;
  max-width: 100%;
  overflow: hidden;
  pointer-events: none;
  position: relative;
  z-index: 1;
}

.overview-timeline-block-main > span,
.overview-timeline-block-main > small {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-timeline-block-main > span {
  font-size: 11px;
}

.overview-timeline-block-main > small {
  font-size: 10px;
}

.overview-timeline-block.compact .overview-timeline-block-main > small,
.overview-timeline-block.tiny .overview-timeline-block-main {
  display: none;
}

@keyframes velair-overview-boost-bars {
  0% {
    opacity: 0;
    transform: translateX(-130%);
  }

  14% {
    opacity: 1;
  }

  86% {
    opacity: 1;
  }

  100% {
    opacity: 0;
    transform: translateX(260%);
  }
}

@media (prefers-reduced-motion: reduce) {
  .overview-timeline-boost::before,
  .overview-timeline-boost::after {
    animation: none;
  }
}

.overview-timeline-tap-detail {
  align-items: center;
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  box-shadow: var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.16));
  box-sizing: border-box;
  color: var(--primary-text-color);
  display: none;
  gap: 8px;
  max-width: min(calc(100% - 16px), 360px);
  min-width: 0;
  padding: 8px 8px 8px 10px;
  position: absolute;
  top: 50%;
  transform: translateY(-50%);
  z-index: 6;
}

.overview-timeline-tap-detail.align-start {
  left: max(8px, var(--overview-detail-left, 50%));
}

.overview-timeline-tap-detail.align-center {
  left: clamp(88px, var(--overview-detail-left, 50%), calc(100% - 88px));
  transform: translate(-50%, -50%);
}

.overview-timeline-tap-detail.align-end {
  right: max(8px, calc(100% - var(--overview-detail-left, 50%)));
}

.overview-timeline-tap-detail span {
  flex: 1 1 auto;
  font-size: 12px;
  min-width: 0;
}

.overview-timeline-tap-detail button {
  align-items: center;
  background: transparent;
  border: 0;
  color: var(--secondary-text-color);
  cursor: pointer;
  display: inline-flex;
  flex: 0 0 auto;
  height: 24px;
  justify-content: center;
  padding: 0;
  width: 24px;
}

.overview-timeline-tap-detail ha-icon {
  --mdc-icon-size: 16px;
}

@media (hover: none), (pointer: coarse) {
  .overview-timeline-tap-detail {
    display: flex;
  }
}

.overview-timeline-empty {
  align-items: center;
  background: color-mix(in srgb, var(--card-background-color) 92%, transparent);
  bottom: 0;
  color: var(--secondary-text-color);
  display: flex;
  font-size: 12px;
  left: 10px;
  padding: 0 10px;
  position: absolute;
  top: 0;
  width: max-content;
  z-index: 6;
}

.overview-zones {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 10px;
  margin-top: 14px;
  min-width: 0;
  padding: 12px;
}

.overview-section-title {
  grid-column: 1 / -1;
  padding: 0 2px;
}

.overview-zone-cards { display: grid; gap: 10px; }
.overview-zone-card { background: var(--card-background-color); border: 1px solid var(--divider-color); border-radius: 8px; container-name: overview-zone-card; container-type: inline-size; display: grid; gap: 10px; padding: 12px; }
.overview-zone-card-heading { align-items: center; display: grid; gap: 12px; grid-template-columns: minmax(150px, .75fr) minmax(0, 1.5fr) 220px; min-width: 0; }
.overview-zone-card-name { display: grid; gap: 2px; min-width: 0; }
.overview-zone-card-name strong, .overview-zone-card-name span { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.overview-zone-card-name span { color: var(--secondary-text-color); font-size: 11px; }
.overview-zone-activity { align-items: center; box-sizing: border-box; display: grid; gap: 10px; grid-template-columns: 36px minmax(0, max-content); justify-self: end; max-width: 220px; min-width: 0; width: fit-content; }
.overview-zone-activity-copy { display: grid; grid-template-rows: repeat(3, minmax(0, auto)); min-width: 0; }
.overview-zone-activity-copy strong, .overview-zone-activity-copy small { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.overview-zone-activity-copy strong { line-height: 1.2; }
.overview-zone-activity-eyebrow { color: var(--secondary-text-color); font-size: 9px; letter-spacing: .06em; line-height: 1.2; text-transform: uppercase; }
.overview-zone-activity-context { color: var(--secondary-text-color); font-size: 10px; line-height: 1.3; }
.overview-zone-activity-icon { align-items: center; background: color-mix(in srgb, var(--primary-color) 10%, transparent); border-radius: 10px; color: var(--primary-color); display: inline-flex; height: 36px; justify-content: center; width: 36px; }
.overview-zone-activity-icon ha-icon { --mdc-icon-size: 20px; }
.overview-zone-activity.state-boost .overview-zone-activity-icon { background: color-mix(in srgb, var(--warning-color, #f9a825) 12%, transparent); color: var(--warning-color, #f9a825); }
.overview-zone-activity.state-paused .overview-zone-activity-icon,
.overview-zone-activity.state-stopped .overview-zone-activity-icon,
.overview-zone-activity.state-idle .overview-zone-activity-icon { background: color-mix(in srgb, var(--secondary-text-color) 10%, transparent); color: var(--secondary-text-color); }
.overview-zone-details { background: var(--secondary-background-color); border: 1px solid var(--divider-color); border-radius: 7px; min-width: 0; padding: 7px 9px; }
.overview-zone-metrics { display: flex; flex-wrap: wrap; gap: 6px; }
.overview-zone-metric { border-right: 1px solid var(--divider-color); display: grid; gap: 2px; min-width: 66px; padding: 1px 12px 1px 2px; }
.overview-zone-metric:last-child { border-right: 0; padding-right: 2px; }
.overview-zone-metric small { color: var(--secondary-text-color); font-size: 11px; text-transform: uppercase; }
.overview-zone-metric strong { font-size: 18px; }
.overview-assist-flow { align-items: stretch; display: flex; flex-wrap: wrap; gap: 6px; }
.overview-assist-group { border-right: 1px solid var(--divider-color); display: grid; gap: 5px; padding: 1px 14px 1px 2px; }
.overview-assist-group > small, .overview-assist-offset small { color: var(--secondary-text-color); font-size: 10px; text-transform: uppercase; }
.overview-assist-group > div { display: flex; gap: 14px; }
.overview-assist-metric, .overview-assist-offset { display: grid; gap: 2px; }
.overview-assist-offset { align-content: end; border-right: 1px solid var(--divider-color); padding: 1px 14px 1px 2px; }
.overview-assist-flow > :last-child { border-right: 0; padding-right: 2px; }
.overview-assist-metric small { color: var(--secondary-text-color); font-size: 10px; text-transform: uppercase; }
.overview-assist-metric strong { font-size: 15px; }
.overview-assist-offset strong { font-size: 15px; }
.overview-zone-signals { align-items: center; display: flex; flex-wrap: wrap; gap: 10px; min-width: 0; overflow: visible; white-space: normal; }
.overview-zone-signals:empty { display: none; }
.overview-zone-signal {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: inline-flex;
  flex: 0 0 auto;
  gap: 5px;
  padding: 3px 7px 3px 5px;
  white-space: nowrap;
}
.overview-zone-signal > span { align-items: baseline; display: flex; gap: 3px; line-height: 1.3; min-width: 0; }
.overview-zone-signal small { color: var(--secondary-text-color); font-size: 12px; line-height: inherit; }
.overview-zone-signal strong { font-size: 12px; line-height: inherit; overflow: hidden; text-overflow: ellipsis; }
.overview-zone-signal ha-icon {
  --mdc-icon-size: 16px;
  align-items: center;
  align-self: center;
  color: var(--secondary-text-color);
  display: inline-flex;
  flex: 0 0 20px;
  height: 20px;
  justify-content: center;
  line-height: 0;
  transform: translateY(-1px);
  width: 20px;
}
.overview-zone-signal.room-assist {
  background: color-mix(in srgb, var(--info-color, #039be5) 9%, var(--card-background-color));
  border-color: color-mix(in srgb, var(--info-color, #039be5) 38%, var(--divider-color));
}
.overview-zone-signal.room-assist ha-icon { color: var(--info-color, #039be5); }
.overview-zone-signal.comfort-environment {
  background: color-mix(in srgb, var(--success-color, #43a047) 9%, var(--card-background-color));
  border-color: color-mix(in srgb, var(--success-color, #43a047) 38%, var(--divider-color));
}
.overview-zone-signal.comfort-environment ha-icon { color: var(--success-color, #43a047); }
.overview-zone-signal.comfort-air {
  background: color-mix(in srgb, var(--cyan-color, #00897b) 9%, var(--card-background-color));
  border-color: color-mix(in srgb, var(--cyan-color, #00897b) 38%, var(--divider-color));
}
.overview-zone-signal.comfort-air ha-icon { color: var(--cyan-color, #00897b); }
.overview-zone-signal.comfort-data {
  background: color-mix(in srgb, var(--warning-color, #f9a825) 9%, var(--card-background-color));
  border-color: color-mix(in srgb, var(--warning-color, #f9a825) 38%, var(--divider-color));
}
.overview-zone-signal.comfort-data ha-icon { color: var(--warning-color, #f9a825); }
.overview-zone-signal.warning {
  background: color-mix(in srgb, var(--warning-color, #f9a825) 10%, var(--card-background-color));
  border-color: color-mix(in srgb, var(--warning-color, #f9a825) 45%, var(--divider-color));
}
.overview-zone-signal.warning ha-icon { color: var(--warning-color, #f9a825); }
.overview-zone-signal.error {
  background: color-mix(in srgb, var(--error-color, #d93025) 10%, var(--card-background-color));
  border-color: color-mix(in srgb, var(--error-color, #d93025) 45%, var(--divider-color));
}
.overview-zone-signal.error ha-icon { color: var(--error-color, #d93025); }
@container overview-zone-card (max-width: 1120px) {
  .overview-zone-card-heading { grid-template-columns: minmax(0, 1fr) minmax(0, 220px); }
  .overview-zone-card-name { grid-column: 1; grid-row: 1; }
  .overview-zone-activity { grid-column: 2; grid-row: 1; justify-self: end; max-width: 100%; width: fit-content; }
  .overview-zone-signals { grid-column: 1 / -1; grid-row: 2; margin: 5px 0; padding: 3px 0; }
  .overview-zone-signal strong { overflow: visible; text-overflow: clip; }
}
@media (max-width: 1200px) {
  .overview-zone-card-heading { grid-template-columns: minmax(0, 1fr) minmax(0, 220px); }
  .overview-zone-card-name { grid-column: 1; grid-row: 1; }
  .overview-zone-activity { grid-column: 2; grid-row: 1; justify-self: end; max-width: 100%; width: fit-content; }
  .overview-zone-signals { grid-column: 1 / -1; grid-row: 2; margin: 5px 0; padding: 3px 0; }
  .overview-zone-signal strong { overflow: visible; text-overflow: clip; }
}
@media (max-width: 600px) {
  .overview-zone-card-heading { align-items: center; grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); }
  .overview-zone-card-name { grid-column: 1; grid-row: 1; }
  .overview-zone-activity { grid-column: 2; grid-row: 1; max-width: 100%; min-width: 0; justify-self: end; width: fit-content; }
  .overview-zone-signals { grid-column: 1 / -1; grid-row: 2; margin: 5px 0; padding: 3px 0; }
  .overview-zone-details { padding: 6px 8px; }
  .overview-zone-metric, .overview-assist-group, .overview-assist-offset { padding-right: 9px; }
}

.panel-empty.embedded {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  padding: 12px;
}

.overview-zone-table-scroll {
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 8px;
  scrollbar-gutter: stable;
}

.overview-zone-table {
  display: grid;
  grid-template-columns:
    minmax(148px, 190px)
    minmax(120px, 0.75fr)
    minmax(230px, 1.35fr)
    minmax(190px, 1.25fr);
  min-width: 680px;
}

.overview-zone-table-row {
  display: contents;
}

.overview-zone-cell {
  align-items: center;
  background: var(--card-background-color);
  border-top: 1px solid var(--divider-color);
  display: flex;
  gap: 6px;
  min-height: 42px;
  min-width: 0;
  padding: 8px 10px;
}

.overview-zone-table-row.header .overview-zone-cell {
  background: var(--secondary-background-color);
  border-top: 0;
  color: var(--secondary-text-color);
  font-size: 11px;
  font-weight: 700;
  min-height: 28px;
  text-transform: uppercase;
}

.overview-zone-cell.sticky {
  border-right: 1px solid var(--divider-color);
  left: 0;
  position: sticky;
  z-index: 2;
}

.overview-zone-table-row.header .overview-zone-cell.sticky {
  z-index: 3;
}

.overview-zone-cell.name {
  align-items: start;
  flex-direction: column;
  gap: 2px;
  justify-content: center;
}

.overview-zone-cell.name strong,
.overview-zone-cell.name span,
.overview-zone-setpoint,
.overview-zone-state,
.overview-mode-value,
.overview-mode-value span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.overview-zone-cell.name strong {
  max-width: 100%;
}

.overview-zone-cell.name span {
  color: var(--secondary-text-color);
  font-size: 11px;
  max-width: 100%;
}

.overview-zone-setpoint {
  align-items: center;
  display: grid;
  gap: 7px;
  max-width: 100%;
  min-width: 0;
}

.overview-zone-setpoint.overridden {
  grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr);
}

.overview-zone-state {
  display: grid;
  gap: 3px;
  line-height: 1.2;
}

.overview-zone-state.previous {
  color: var(--secondary-text-color);
}

.overview-zone-state.previous strong,
.overview-zone-state.previous span {
  text-decoration: line-through;
}

.overview-zone-transition {
  align-items: center;
  display: flex;
  justify-content: center;
  min-width: 28px;
}

.overview-zone-transition-symbol {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 999px;
  box-sizing: border-box;
  display: grid;
  justify-items: center;
  min-width: 28px;
  padding: 2px 4px;
}

.overview-zone-transition-symbol ha-icon {
  --mdc-icon-size: 15px;
  flex: 0 0 auto;
}

.overview-zone-transition .overview-zone-cause {
  margin-bottom: -2px;
}

.overview-zone-transition .overview-zone-arrow {
  color: var(--secondary-text-color);
}

.overview-zone-setpoint.boost .overview-zone-cause,
.overview-zone-status.boost ha-icon {
  color: var(--warning-color, #f9a825);
}

.overview-zone-setpoint.pause .overview-zone-cause,
.overview-zone-status.pause ha-icon {
  color: var(--warning-color, #c99500);
}

.overview-zone-status {
  align-items: flex-start;
  display: inline-flex;
  gap: 6px;
  line-height: 1.35;
  max-width: 100%;
  min-width: 0;
  white-space: normal;
}

.overview-zone-status span {
  min-width: 0;
  overflow-wrap: anywhere;
}

.overview-zone-status ha-icon {
  --mdc-icon-size: 16px;
  flex: 0 0 auto;
}

.overview-mode-value {
  align-items: center;
  display: inline-flex;
  line-height: 1.2;
  min-width: 0;
}

.overview-mode-value span {
  overflow: hidden;
  line-height: 1.2;
  text-overflow: ellipsis;
}

.overview-boost-status {
  align-items: center;
  background: color-mix(in srgb, var(--warning-color, #f9a825) 14%, var(--card-background-color));
  border: 1px solid color-mix(in srgb, var(--warning-color, #f9a825) 44%, var(--divider-color));
  border-radius: 8px;
  color: var(--primary-text-color);
  display: grid;
  gap: 10px;
  grid-template-columns: auto minmax(0, 1fr);
  min-width: 0;
  padding: 10px;
}

.overview-boost-status ha-icon {
  color: var(--warning-color, #f9a825);
}

.overview-boost-status strong,
.overview-boost-status span {
  display: block;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.panel-empty.embedded {
  align-items: center;
  display: grid;
  gap: 16px;
  grid-template-columns: auto minmax(0, 1fr);
}

.panel-empty.embedded ha-icon {
  color: var(--primary-color);
  height: 28px;
  width: 28px;
}

.event-list,
.draft-list,
.copy-targets {
  display: grid;
  gap: 8px;
}

.event-list {
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding-bottom: 8px;
  scrollbar-gutter: stable;
}

.next .event-list {
  margin-top: 14px;
  padding-inline-start: 2px;
}

.next .event {
  box-sizing: border-box;
  min-width: calc(150px + 62ch + 24px);
  width: 100%;
}

.draft-empty {
  align-items: center;
  background: var(--card-background-color);
  border: 1px dashed var(--divider-color);
  border-radius: 8px;
  display: flex;
  justify-content: center;
  min-height: 46px;
  padding: 10px;
  text-align: center;
}

.event {
  align-items: center;
  border-top: 1px solid var(--divider-color);
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(110px, 1fr) max-content;
  min-width: 0;
  padding-top: 8px;
}

.event > div:first-child {
  min-width: 0;
}

.event > div:first-child strong {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-details {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: 18ch 8ch 12ch;
  justify-content: end;
  min-width: 0;
  width: max-content;
}

.next .event-details,
.next .event-details.preconditioned {
  grid-template-columns: 42ch 8ch 12ch;
}

.event-details strong,
.event-details span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.event-details strong {
  color: var(--primary-text-color);
  font-size: 14px;
  text-align: end;
}

.event-time {
  color: var(--secondary-text-color);
}

.next .event-time {
  align-items: center;
  display: flex;
  justify-content: flex-end;
  overflow: visible;
  width: 100%;
}

.event-time-flow {
  align-items: center;
  display: inline-flex;
  gap: 6px;
  justify-content: flex-end;
  overflow: visible;
  white-space: nowrap;
}

.event-time-sequence ha-icon {
  --mdc-icon-size: 16px;
  color: var(--secondary-text-color);
  flex: 0 0 auto;
}

.event-time-sequence .preconditioning-icon {
  color: var(--primary-color);
}

.event-time-sequence .preconditioning-arrow {
  color: var(--primary-text-color);
}

.event-time-sequence .target-time {
  color: var(--secondary-text-color);
  font-weight: 400;
}

.event-time-sequence .preconditioning-start {
  color: var(--primary-text-color);
  font-weight: 700;
}

.event-target {
  justify-self: end;
}

.event-mode {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 999px;
  justify-self: end;
  line-height: 1;
  padding: 3px 7px;
}

.event:first-of-type {
  border-top: 0;
  padding-top: 0;
}

.event-time-flow.next-event-updated {
  border-radius: 3px;
}

.event-time-flow.next-event-updated.update-odd {
  animation: velair-next-event-updated-odd 2.2s ease-out;
}

.event-time-flow.next-event-updated.update-even {
  animation: velair-next-event-updated-even 2.2s ease-out;
}

@keyframes velair-next-event-updated-odd {
  0% {
    background: color-mix(in srgb, var(--primary-color) 18%, transparent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 18%, transparent);
  }
  100% {
    background: transparent;
    box-shadow: 0 0 0 4px transparent;
  }
}

@keyframes velair-next-event-updated-even {
  0% {
    background: color-mix(in srgb, var(--primary-color) 18%, transparent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 18%, transparent);
  }
  100% {
    background: transparent;
    box-shadow: 0 0 0 4px transparent;
  }
}

@media (prefers-reduced-motion: reduce) {
  .event-time-flow.next-event-updated.update-odd,
  .event-time-flow.next-event-updated.update-even {
    animation: none;
    background: color-mix(in srgb, var(--primary-color) 12%, transparent);
    box-shadow: 0 0 0 4px color-mix(in srgb, var(--primary-color) 18%, transparent);
  }
}

.summary-icon-button {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  color: var(--primary-text-color);
  cursor: pointer;
  display: inline-flex;
  height: 34px;
  justify-content: center;
  list-style: none;
  width: 34px;
}

.summary-icon-button:hover {
  background: color-mix(in srgb, var(--primary-color) 12%, var(--secondary-background-color));
  border-color: color-mix(in srgb, var(--primary-color) 38%, var(--divider-color));
}

.summary-icon-button ha-icon {
  --mdc-icon-size: 18px;
}
`, rn = u`
  .settings-portability {
    display: grid;
    gap: 12px;
  }

  .settings-portability-heading {
    align-items: center;
    display: grid;
    gap: 12px;
    grid-template-columns: 36px minmax(0, 1fr);
  }

  .settings-portability p {
    color: var(--secondary-text-color);
    font-size: 12px;
    margin: 4px 0 0;
  }

  .portability-grid {
    align-items: start;
    display: grid;
    gap: 10px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    min-width: 0;
  }

  .portability-card {
    align-content: start;
    background: var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    display: grid;
    gap: 10px;
    min-width: 0;
    padding: 10px;
  }

  .portability-options {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    min-width: 0;
  }

  .portable-option {
    align-items: center;
    background: var(--secondary-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 999px;
    color: var(--primary-text-color);
    display: inline-flex;
    gap: 6px;
    min-height: 30px;
    padding: 0 10px;
  }

  .portable-option input {
    accent-color: var(--primary-color);
    margin: 0;
    min-height: 0;
    padding: 0;
    width: auto;
  }

  .portable-option span {
    color: inherit;
    font-size: 12px;
    margin: 0;
    white-space: nowrap;
  }

  .portable-option strong {
    color: var(--primary-text-color);
    font-size: 12px;
    font-weight: 700;
    margin: 0;
  }

  .portable-file-field {
    cursor: pointer;
    display: grid;
    gap: 6px;
  }

  .portable-file-control {
    align-items: center;
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    display: flex;
    min-height: 38px;
    min-width: 0;
    overflow: hidden;
  }

  .portable-file-control input {
    height: 1px;
    opacity: 0;
    overflow: hidden;
    position: absolute;
    width: 1px;
  }

  .portable-file-button {
    align-items: center;
    align-self: stretch;
    background: var(--primary-color);
    color: var(--text-primary-color);
    display: inline-flex;
    flex: 0 0 auto;
    font-size: 13px;
    font-weight: 600;
    padding: 0 12px;
    white-space: nowrap;
  }

  .portable-file-name {
    color: var(--secondary-text-color);
    flex: 1 1 auto;
    font-size: 13px;
    min-width: 0;
    overflow: hidden;
    padding: 0 10px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .portable-warning {
    align-items: start;
    background: color-mix(in srgb, var(--warning-color, #c99500) 14%, var(--card-background-color));
    border: 1px solid color-mix(in srgb, var(--warning-color, #c99500) 58%, var(--divider-color));
    border-radius: 8px;
    color: var(--primary-text-color);
    display: grid;
    font-size: 12px;
    gap: 8px;
    grid-template-columns: 18px minmax(0, 1fr);
    padding: 8px;
  }

  .portable-warning ha-icon {
    --mdc-icon-size: 18px;
    color: var(--warning-color, #c99500);
  }
`, an = u`
.preconditioning-view {
  display: grid;
  gap: 12px;
  min-width: 0;
}

.preconditioning-intro {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: 24px minmax(0, 1fr);
  padding: 2px 4px 4px;
}

.preconditioning-intro > ha-icon {
  --mdc-icon-size: 22px;
  color: var(--primary-color);
}

.preconditioning-intro > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.preconditioning-intro strong {
  color: var(--primary-text-color);
  font-size: 14px;
  line-height: 1.25;
}

.preconditioning-intro small {
  color: var(--secondary-text-color);
  font-size: 12px;
  line-height: 1.35;
}

.preconditioning-zone {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  min-width: 0;
  overflow: visible;
  position: relative;
}

.preconditioning-zone-heading {
  align-items: center;
  background: var(--card-background-color);
  border-bottom: 1px solid var(--divider-color);
  cursor: pointer;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  padding: 12px;
  border-radius: 8px 8px 0 0;
}

.preconditioning-zone.collapsed .preconditioning-zone-heading {
  border-bottom: 0;
  border-radius: 8px;
}

.preconditioning-zone-toggle {
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 8px;
  grid-template-columns: 20px minmax(0, 1fr);
  min-width: 0;
  padding: 0;
  text-align: left;
}

.preconditioning-zone-toggle:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 4px;
}

.preconditioning-zone-toggle:disabled {
  cursor: default;
}

.preconditioning-zone-toggle:disabled .preconditioning-expand-icon {
  opacity: 0.45;
}

.preconditioning-zone-toggle > ha-icon {
  --mdc-icon-size: 20px;
}

.preconditioning-expand-icon {
  color: var(--secondary-text-color);
}

.preconditioning-zone-actions,
.preconditioning-enable-control {
  align-items: center;
  display: flex;
  gap: 8px;
  min-width: 0;
}

.preconditioning-settings-reset {
  height: 32px;
  width: 32px;
}

.preconditioning-settings-reset ha-icon {
  --mdc-icon-size: 18px;
}

.preconditioning-unavailable-message {
  color: var(--secondary-text-color);
  display: none;
  font-size: 12px;
  line-height: 1.3;
}

.preconditioning-zone-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
  text-align: left;
}

.preconditioning-zone-identity strong,
.preconditioning-zone-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preconditioning-zone-identity strong {
  color: var(--primary-text-color);
  font-size: 14px;
}

.preconditioning-zone-identity span {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.preconditioning-zone-content {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 12px;
}

.preconditioning-config-sections {
  display: grid;
  gap: 16px 24px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 0;
}

.preconditioning-config-section {
  align-content: start;
  border: 1px solid var(--divider-color);
  border-radius: 6px;
  display: grid;
  gap: 0;
  grid-template-rows: max-content max-content;
  min-width: 0;
  position: relative;
}

.preconditioning-config-section:focus-within,
.preconditioning-config-section:hover {
  z-index: 3;
}

.preconditioning-config-section h3,
.preconditioning-learning-heading {
  align-items: center;
  border-bottom: 1px solid var(--divider-color);
  color: var(--primary-text-color);
  display: flex;
  font-size: 13px;
  font-weight: 700;
  gap: 6px;
  margin: 0;
  padding: 0 0 7px;
}

.preconditioning-config-section h3 {
  background: var(--secondary-background-color);
  border-radius: 5px 5px 0 0;
  padding: 8px 10px;
}

.preconditioning-config-section h3 ha-icon,
.preconditioning-learning-heading ha-icon {
  --mdc-icon-size: 17px;
  color: var(--primary-color);
}

.preconditioning-config-rows {
  align-content: start;
  display: grid;
  min-width: 0;
  padding: 0 10px 4px;
}

.preconditioning-config-row {
  align-items: center;
  border-top: 1px solid color-mix(in srgb, var(--divider-color) 65%, transparent);
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) minmax(96px, 120px);
  min-height: 42px;
  min-width: 0;
  padding: 6px 0;
  position: relative;
}

.preconditioning-config-row:first-child {
  border-top: 0;
}

.preconditioning-config-row > .label {
  color: var(--secondary-text-color);
  font-size: 12px;
  line-height: 1.3;
  min-width: 0;
  overflow-wrap: anywhere;
}

.preconditioning-config-label {
  align-items: center;
  display: flex;
  gap: 4px;
}

.preconditioning-help {
  align-items: center;
  color: var(--secondary-text-color);
  cursor: help;
  display: inline-flex;
  flex: 0 0 auto;
  outline: none;
  position: relative;
}

.preconditioning-help ha-icon {
  --mdc-icon-size: 15px;
}

.preconditioning-help-tooltip {
  background: var(--primary-text-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
  color: var(--primary-background-color);
  font-size: 11px;
  font-weight: 400;
  left: 50%;
  line-height: 1.35;
  max-width: min(240px, calc(100vw - 40px));
  opacity: 0;
  padding: 7px 8px;
  pointer-events: none;
  position: absolute;
  top: calc(100% + 6px);
  transform: translateX(-22px);
  transition: opacity 120ms ease, visibility 120ms ease;
  visibility: hidden;
  white-space: normal;
  width: max-content;
  z-index: 20;
}

.preconditioning-help:hover .preconditioning-help-tooltip,
.preconditioning-help:focus .preconditioning-help-tooltip,
.preconditioning-help:focus-visible .preconditioning-help-tooltip {
  opacity: 1;
  visibility: visible;
}

.preconditioning-config-row input,
.preconditioning-config-row select {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 6px;
  box-sizing: border-box;
  color: var(--primary-text-color);
  min-width: 0;
  padding: 7px 8px;
  width: 100%;
}

.preconditioning-sensor-row {
  grid-template-columns: minmax(0, 1fr) minmax(150px, 1.4fr);
}

.preconditioning-sensor-row.inactive select {
  background: color-mix(in srgb, var(--disabled-text-color) 10%, var(--card-background-color));
  border-style: dashed;
  color: var(--secondary-text-color);
}

.preconditioning-config-row.inactive input {
  background: color-mix(in srgb, var(--disabled-text-color) 10%, var(--card-background-color));
  border-style: dashed;
  color: var(--secondary-text-color);
}

.preconditioning-config-row.inactive ha-switch {
  opacity: 0.6;
}

.preconditioning-toggle-row ha-switch {
  justify-self: end;
}

.preconditioning-learning {
  border-top: 1px dashed var(--divider-color);
  display: grid;
  gap: 8px;
  min-width: 0;
  padding-top: 12px;
}

.preconditioning-learning-heading {
  margin-bottom: 8px;
}

.preconditioning-directions {
  align-items: start;
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 0;
}

.preconditioning-direction {
  display: grid;
  gap: 8px;
  min-width: 0;
}

.preconditioning-direction.heat {
  --preconditioning-accent: #d95f24;
}

.preconditioning-direction.cool {
  --preconditioning-accent: #2d7dd2;
}

.preconditioning-direction-heading {
  align-items: center;
  background: color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 8%, var(--card-background-color));
  border: 1px solid color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 22%, var(--divider-color));
  border-radius: 5px;
  color: var(--primary-text-color);
  display: flex;
  font-size: 13px;
  font-weight: 700;
  justify-content: space-between;
  min-width: 0;
  padding: 6px 7px;
}

.preconditioning-direction-heading span {
  align-items: center;
  display: inline-flex;
  gap: 5px;
  min-width: 0;
}

.preconditioning-direction-heading ha-icon {
  --mdc-icon-size: 16px;
  color: var(--preconditioning-accent, var(--primary-color));
}

.preconditioning-prediction {
  background:
    linear-gradient(
      90deg,
      color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 10%, transparent),
      transparent 40%
    ),
    var(--secondary-background-color);
  border: 1px solid color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 18%, var(--divider-color));
  border-left: 3px solid var(--preconditioning-accent, var(--primary-color));
  border-radius: 6px;
  display: grid;
  gap: 8px;
  min-width: 0;
  padding: 8px;
}

.preconditioning-prediction.heat {
  --preconditioning-accent: #d95f24;
}

.preconditioning-prediction.cool {
  --preconditioning-accent: #2d7dd2;
}

.preconditioning-prediction-heading {
  align-items: center;
  display: flex;
  gap: 8px;
  justify-content: space-between;
  min-width: 0;
}

.preconditioning-prediction-heading > span:first-child {
  color: var(--primary-text-color);
  font-size: 12px;
  font-weight: 600;
}

.preconditioning-live-label {
  align-items: center;
  background: color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 10%, var(--card-background-color));
  border: 1px solid color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 20%, var(--divider-color));
  border-radius: 999px;
  color: var(--secondary-text-color);
  display: inline-flex;
  font-size: 12px;
  font-weight: 600;
  gap: 5px;
  min-width: 0;
  padding: 3px 8px;
  white-space: nowrap;
}

.preconditioning-live-label > span:first-child {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preconditioning-live-label .preconditioning-help {
  color: var(--secondary-text-color);
}

.preconditioning-block-preview {
  align-items: stretch;
  display: grid;
  grid-template-columns: minmax(96px, 0.72fr) minmax(150px, 1.28fr);
  min-width: 0;
}

.preconditioning-block-preview.normal-start {
  grid-template-columns: minmax(0, 1fr);
}

.preconditioning-prestart {
  align-content: center;
  background:
    repeating-linear-gradient(
      135deg,
      color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 5%, transparent) 0 8px,
      transparent 8px 16px
    ),
    color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 4%, var(--card-background-color));
  border: 1px dashed color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 42%, var(--divider-color));
  border-radius: 8px 0 0 8px;
  border-right: 0;
  box-sizing: border-box;
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 8px 10px;
  position: relative;
}

.preconditioning-prestart::after {
  border-bottom: 8px solid transparent;
  border-left: 9px solid color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 48%, var(--divider-color));
  border-top: 8px solid transparent;
  content: "";
  position: absolute;
  right: -9px;
  top: calc(50% - 8px);
  z-index: 1;
}

.preconditioning-prestart small,
.preconditioning-preview-block small {
  color: color-mix(in srgb, var(--primary-text-color) 72%, var(--secondary-text-color));
  font-size: 10px;
  line-height: 1.2;
}

.preconditioning-prestart strong,
.preconditioning-prestart span,
.preconditioning-preview-block strong,
.preconditioning-preview-block span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preconditioning-prestart strong,
.preconditioning-preview-block strong {
  color: var(--primary-text-color);
  font-size: 12px;
  font-weight: 700;
}

.preconditioning-prestart span {
  color: color-mix(in srgb, var(--primary-text-color) 80%, var(--secondary-text-color));
  font-size: 11px;
  font-weight: 500;
}

.preconditioning-preview-block {
  align-content: center;
  background: var(--timeline-bg, color-mix(in srgb, var(--primary-color) 18%, var(--card-background-color)));
  border: 1px solid var(--timeline-border, color-mix(in srgb, var(--primary-color) 42%, var(--divider-color)));
  border-radius: 8px;
  box-sizing: border-box;
  display: grid;
  gap: 1px;
  min-width: 0;
  padding: 9px 12px;
  position: relative;
}

.preconditioning-block-preview.with-prestart .preconditioning-preview-block {
  border-radius: 0 8px 8px 0;
}

.preconditioning-preview-block.mode-heat {
  --timeline-bg: color-mix(in srgb, #d95f24 18%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, #d95f24 48%, var(--divider-color));
}

.preconditioning-preview-block.mode-cool {
  --timeline-bg: color-mix(in srgb, #2d7dd2 18%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, #2d7dd2 48%, var(--divider-color));
}

.preconditioning-preview-block span {
  color: var(--primary-text-color);
  font-size: 11px;
}

.preconditioning-calculation-details {
  background: color-mix(in srgb, var(--card-background-color) 78%, transparent);
  border: 1px solid color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 14%, var(--divider-color));
  border-radius: 6px;
  color: var(--secondary-text-color);
  min-width: 0;
}

.preconditioning-calculation-details summary {
  align-items: center;
  cursor: pointer;
  display: flex;
  font-size: 12px;
  font-weight: 600;
  gap: 6px;
  min-width: 0;
  padding: 7px 8px;
}

.preconditioning-calculation-details summary::marker {
  color: var(--secondary-text-color);
}

.preconditioning-calculation-details summary ha-icon {
  --mdc-icon-size: 15px;
  color: var(--preconditioning-accent, var(--primary-color));
}

.preconditioning-calculation-grid {
  border-top: 1px solid var(--divider-color);
  display: grid;
  gap: 6px;
  padding: 8px;
}

.preconditioning-calculation-row {
  display: grid;
  gap: 6px;
  min-width: 0;
}

.preconditioning-calculation-row.context {
  grid-template-columns: minmax(148px, 1.6fr) minmax(64px, 0.55fr) minmax(82px, 0.65fr);
}

.preconditioning-calculation-row.estimates {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.preconditioning-calculation-row.result.with-rounded {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.preconditioning-calculation-row.result.without-rounded {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.preconditioning-calculation-item {
  background: var(--secondary-background-color);
  border: 1px solid color-mix(in srgb, var(--divider-color) 72%, transparent);
  border-radius: 5px;
  display: grid;
  gap: 2px;
  min-width: 0;
  padding: 6px 7px;
}

.preconditioning-calculation-label-text,
.preconditioning-calculation-item strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preconditioning-calculation-label {
  color: var(--secondary-text-color);
  cursor: help;
  display: block;
  font-size: 10px;
  line-height: 1.2;
  min-width: 0;
  outline: none;
  position: relative;
}

.preconditioning-calculation-label:focus-visible .preconditioning-calculation-label-text {
  outline: 1px solid var(--primary-color);
  outline-offset: 2px;
}

.preconditioning-calculation-label-text {
  display: block;
}

.preconditioning-calculation-tooltip {
  background: var(--primary-text-color);
  border-radius: 4px;
  bottom: calc(100% + 6px);
  box-shadow: 0 6px 16px rgba(0, 0, 0, 0.22);
  color: var(--card-background-color);
  font-size: 11px;
  left: 0;
  line-height: 1.25;
  max-width: min(240px, 78vw);
  opacity: 0;
  padding: 5px 7px;
  pointer-events: none;
  position: absolute;
  transform: translateY(2px);
  transition: opacity 120ms ease, transform 120ms ease;
  visibility: hidden;
  white-space: normal;
  width: max-content;
  z-index: 12;
}

.preconditioning-calculation-row.context .preconditioning-calculation-item:last-child .preconditioning-calculation-tooltip,
.preconditioning-calculation-row.result .preconditioning-calculation-item:last-child .preconditioning-calculation-tooltip {
  left: auto;
  right: 0;
}

.preconditioning-calculation-label:hover .preconditioning-calculation-tooltip,
.preconditioning-calculation-label:focus .preconditioning-calculation-tooltip,
.preconditioning-calculation-label:focus-visible .preconditioning-calculation-tooltip {
  opacity: 1;
  transform: translateY(0);
  visibility: visible;
}

.preconditioning-calculation-item strong {
  color: var(--primary-text-color);
  font-size: 12px;
  font-weight: 650;
}

.preconditioning-calculation-item.samples strong {
  line-height: 1.25;
  white-space: normal;
}

.preconditioning-calculation-item.compact {
  text-align: center;
}

.preconditioning-calculation-item.final {
  border-color: color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 26%, var(--divider-color));
}

.preconditioning-prediction-empty {
  align-items: center;
  color: var(--secondary-text-color);
  display: grid;
  font-size: 12px;
  gap: 8px;
  grid-template-columns: 20px minmax(0, 1fr);
  min-width: 0;
}

.preconditioning-prediction-empty ha-icon {
  --mdc-icon-size: 18px;
}

.preconditioning-learning-reset {
  height: 28px;
  width: 28px;
}

.preconditioning-learning-reset ha-icon {
  --mdc-icon-size: 16px;
  color: var(--primary-color);
}

.preconditioning-learning-status-card {
  display: grid;
  gap: 7px;
  min-width: 0;
}

.preconditioning-learning-summary {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  min-width: 0;
}

.preconditioning-learning-indicator {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 6px;
  display: grid;
  gap: 7px;
  grid-template-columns: 20px minmax(0, 1fr);
  min-width: 0;
  padding: 7px;
}

.preconditioning-learning-indicator ha-icon {
  --mdc-icon-size: 19px;
  color: var(--secondary-text-color);
}

.preconditioning-learning-indicator.ready ha-icon,
.preconditioning-learning-indicator.history ha-icon {
  color: var(--success-color, #2e7d32);
}

.preconditioning-learning-indicator.learning ha-icon {
  color: var(--preconditioning-accent, var(--primary-color));
}

.preconditioning-learning-indicator > span {
  display: grid;
  gap: 1px;
  min-width: 0;
}

.preconditioning-learning-indicator small,
.preconditioning-learning-indicator strong {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preconditioning-learning-indicator small {
  color: var(--secondary-text-color);
  font-size: 10px;
}

.preconditioning-learning-indicator strong {
  color: var(--primary-text-color);
  font-size: 12px;
  font-weight: 600;
}

.preconditioning-sample-chips {
  display: grid;
  gap: 6px;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  min-width: 0;
}

.preconditioning-sample-card {
  background: color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 3%, var(--secondary-background-color));
  border: 1px solid color-mix(in srgb, var(--preconditioning-accent, var(--primary-color)) 12%, var(--divider-color));
  border-radius: 6px;
  min-width: 0;
  padding: 6px;
}

.preconditioning-sample-chip {
  align-items: center;
  background: color-mix(in srgb, var(--sample-chip-color, var(--primary-color)) 8%, var(--card-background-color));
  border: 1px solid color-mix(in srgb, var(--sample-chip-color, var(--primary-color)) 20%, var(--divider-color));
  border-radius: 999px;
  color: var(--secondary-text-color);
  display: inline-flex;
  font-size: 11px;
  gap: 5px;
  justify-content: center;
  line-height: 1.2;
  min-height: 22px;
  min-width: 0;
  padding: 2px 7px;
  white-space: nowrap;
}

.preconditioning-sample-chip.complete {
  --sample-chip-color: var(--success-color, #2e7d32);
}

.preconditioning-sample-chip.partial {
  --sample-chip-color: #b06a00;
}

.preconditioning-sample-chip.invalid {
  --sample-chip-color: var(--error-color, #ba1a1a);
}

.preconditioning-sample-chip span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}

.preconditioning-sample-chip strong {
  color: var(--primary-text-color);
  font-size: 11px;
}

`, on = u`
.sensors-view {
  display: grid;
  gap: 12px;
}

.sensors-intro {
  align-items: center;
  display: grid;
  gap: 10px;
  grid-template-columns: 24px minmax(0, 1fr);
  padding: 2px 4px 4px;
}

.sensors-intro > ha-icon {
  --mdc-icon-size: 22px;
  color: var(--primary-color);
}

.sensors-intro > span {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sensors-intro strong {
  color: var(--primary-text-color);
  font-size: 14px;
  line-height: 1.25;
}

.sensors-intro small {
  color: var(--secondary-text-color);
  font-size: 12px;
  line-height: 1.35;
}

.sensor-zone {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  min-width: 0;
  overflow: visible;
  position: relative;
}

.sensor-zone-heading {
  align-items: center;
  background: var(--card-background-color);
  border-bottom: 1px solid var(--divider-color);
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  display: grid;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr) auto;
  min-width: 0;
  padding: 12px;
}

.sensor-zone.collapsed .sensor-zone-heading {
  border-bottom: 0;
  border-radius: 8px;
}

.sensor-zone-toggle {
  align-items: center;
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 8px;
  grid-template-columns: 20px minmax(0, 1fr);
  min-width: 0;
  padding: 0;
  text-align: left;
}

.sensor-zone-toggle:focus-visible {
  outline: 2px solid var(--primary-color);
  outline-offset: 4px;
}

.sensor-zone-toggle:disabled {
  cursor: default;
}

.sensor-zone-toggle:disabled .sensor-expand-icon {
  color: var(--disabled-text-color);
  opacity: 0.45;
}

.sensor-zone-toggle > ha-icon {
  --mdc-icon-size: 20px;
  color: var(--secondary-text-color);
}

.sensor-zone-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.sensor-zone-identity strong,
.sensor-zone-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sensor-zone-identity strong {
  color: var(--primary-text-color);
  font-size: 14px;
}

.sensor-zone-identity span {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.sensor-zone-actions {
  align-items: center;
  display: flex;
  flex: 0 0 auto;
  gap: 10px;
  justify-content: flex-end;
}

.sensor-enable-control.unavailable {
  cursor: help;
  opacity: 0.55;
}

.sensor-zone-content {
  display: grid;
  gap: 12px;
  min-width: 0;
  padding: 12px;
}

.sensor-config-section,
.sensor-runtime-section {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  overflow: visible;
  position: relative;
}

.sensor-config-section:focus-within,
.sensor-config-section:hover,
.sensor-runtime-section:focus-within,
.sensor-runtime-section:hover {
  z-index: 3;
}

.sensor-config-section h3,
.sensor-runtime-section h3 {
  align-items: center;
  background: color-mix(in srgb, var(--primary-text-color) 6%, transparent);
  border-bottom: 1px solid var(--divider-color);
  color: var(--primary-text-color);
  display: flex;
  font-size: 13px;
  font-weight: 700;
  gap: 8px;
  justify-content: space-between;
  letter-spacing: 0;
  margin: 0;
  padding: 10px 12px;
}

.sensor-section-title {
  align-items: center;
  display: inline-flex;
  gap: 8px;
  min-width: 0;
}

.sensor-config-section h3 ha-icon,
.sensor-runtime-section h3 ha-icon {
  color: var(--primary-color);
  height: 18px;
  width: 18px;
}

.sensor-config-rows {
  display: grid;
}

.sensor-config-row {
  align-items: center;
  border-top: 1px solid var(--divider-color);
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(0, 1fr) minmax(180px, 260px);
  padding: 12px;
}

.sensor-config-row:first-child {
  border-top: 0;
}

.sensor-config-row.inactive {
  opacity: 0.62;
}

.sensor-number-input {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) auto;
}

.sensor-number-input > span {
  color: var(--secondary-text-color);
  font-size: 12px;
  white-space: nowrap;
}

.sensor-config-label {
  align-items: center;
  color: var(--primary-text-color);
  display: inline-flex;
  gap: 6px;
  min-width: 0;
}

.sensor-help {
  align-items: center;
  color: var(--secondary-text-color);
  cursor: help;
  display: inline-flex;
  flex: 0 0 auto;
  outline: none;
  position: relative;
}

.sensor-help ha-icon {
  --mdc-icon-size: 15px;
}

.sensor-help-tooltip {
  background: var(--primary-text-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
  color: var(--primary-background-color);
  font-size: 11px;
  font-weight: 400;
  left: 50%;
  line-height: 1.35;
  max-width: min(240px, calc(100vw - 40px));
  opacity: 0;
  padding: 7px 8px;
  pointer-events: none;
  position: absolute;
  top: calc(100% + 6px);
  transform: translateX(-22px);
  transition: opacity 120ms ease, visibility 120ms ease;
  visibility: hidden;
  white-space: normal;
  width: max-content;
  z-index: 20;
}

.sensor-help:hover .sensor-help-tooltip,
.sensor-help:focus .sensor-help-tooltip,
.sensor-help:focus-visible .sensor-help-tooltip {
  opacity: 1;
  visibility: visible;
}

.sensor-status-card {
  display: grid;
  gap: 12px;
  padding: 12px;
}

.sensor-inactive-section p {
  color: var(--secondary-text-color);
  font-size: 13px;
  line-height: 1.4;
  margin: 0;
  padding: 12px;
}

.sensor-inactive-section h3 ha-icon {
  align-items: center;
  display: inline-flex;
  justify-content: center;
  line-height: 1;
}

.sensor-block-summary {
  display: grid;
  gap: 8px;
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.sensor-block-detail {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 7px;
  color: var(--secondary-text-color);
  display: grid;
  font-size: 12px;
  gap: 7px;
  grid-template-columns: 18px minmax(0, 1fr);
  line-height: 1.3;
  min-width: 0;
  padding: 8px 9px;
}

.sensor-block-detail ha-icon {
  --mdc-icon-size: 17px;
  color: var(--secondary-text-color);
}

.sensor-block-detail.emphasis {
  border-color: color-mix(in srgb, var(--primary-color) 35%, var(--divider-color));
  color: var(--primary-text-color);
}

.sensor-block-detail.emphasis ha-icon {
  color: var(--primary-color);
}

.sensor-status-pill {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 999px;
  color: var(--primary-text-color);
  display: inline-flex;
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  padding: 5px 9px;
  white-space: nowrap;
}

.sensor-status-pill.assisting,
.sensor-status-pill.ready {
  background: color-mix(in srgb, var(--primary-color) 12%, transparent);
  border-color: color-mix(in srgb, var(--primary-color) 36%, var(--divider-color));
}

.sensor-status-pill.holding {
  background: color-mix(in srgb, var(--success-color, #43a047) 12%, transparent);
  border-color: color-mix(in srgb, var(--success-color, #43a047) 36%, var(--divider-color));
}

.sensor-status-pill.blocked,
.sensor-status-pill.unavailable {
  background: color-mix(in srgb, var(--warning-color, #f9a825) 14%, transparent);
  border-color: color-mix(in srgb, var(--warning-color, #f9a825) 38%, var(--divider-color));
}

.sensor-temperature-scale {
  --sensor-scale-line-end: #2d7dd2;
  --sensor-scale-line-start: color-mix(in srgb, var(--secondary-text-color) 22%, transparent);
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 6px;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  padding: 12px 12px 10px;
}

.sensor-temperature-scale.mode-heat {
  --sensor-scale-line-end: #d95f24;
}

.sensor-temperature-scale.mode-heat-cool {
  --sensor-scale-line-end: #2d7dd2;
  --sensor-scale-line-start: color-mix(in srgb, #d95f24 62%, transparent);
}

.sensor-scale-track {
  min-height: 136px;
  min-width: 640px;
  position: relative;
}

.sensor-scale-line {
  background: linear-gradient(
    90deg,
    var(--sensor-scale-line-start),
    color-mix(in srgb, var(--sensor-scale-line-end) 38%, transparent)
  );
  border-radius: 999px;
  display: block;
  height: 6px;
  left: 0;
  position: absolute;
  right: 0;
  top: 66px;
}

.sensor-scale-relation {
  display: block;
  height: 0;
  min-width: 18px;
  position: absolute;
}

.sensor-scale-room-gap {
  border-top: 2px solid color-mix(in srgb, var(--secondary-text-color) 46%, transparent);
  top: 83px;
}

.sensor-scale-assist-offset {
  top: 108px;
}

.sensor-scale-assist-offset.assist-offset-active {
  border-top: 3px dashed color-mix(in srgb, var(--success-color, #43a047) 74%, transparent);
}

.sensor-scale-assist-offset.assist-offset-holding {
  border-top: 2px dotted color-mix(in srgb, var(--secondary-text-color) 62%, transparent);
}

.sensor-scale-assist-offset.assist-offset-unknown {
  border-top: 2px dashed color-mix(in srgb, var(--secondary-text-color) 42%, transparent);
}

.sensor-scale-relation span {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 999px;
  color: var(--primary-text-color);
  font-size: 10px;
  font-weight: 700;
  left: 50%;
  line-height: 1;
  padding: 3px 6px;
  position: absolute;
  top: 6px;
  transform: translateX(-50%);
  white-space: nowrap;
}

.sensor-scale-room-gap span {
  color: var(--secondary-text-color);
}

.sensor-scale-assist-offset.assist-offset-active span {
  border-color: color-mix(in srgb, var(--success-color, #43a047) 38%, var(--divider-color));
  color: var(--success-color, #43a047);
}

.sensor-scale-assist-offset.assist-offset-holding span,
.sensor-scale-assist-offset.assist-offset-unknown span {
  color: var(--secondary-text-color);
}

.sensor-scale-marker {
  display: block;
  height: 0;
  position: absolute;
  top: 69px;
  transform: translateX(-50%);
  width: 0;
  z-index: 1;
}

.sensor-scale-callout-marker {
  --callout-left: 50%;
  display: block;
  height: 0;
  left: clamp(72px, var(--callout-left), calc(100% - 72px));
  position: absolute;
  top: 69px;
  width: 0;
  z-index: 2;
}

.sensor-scale-callout {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-left: 3px solid var(--secondary-text-color);
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);
  bottom: 18px;
  display: grid;
  gap: 1px;
  left: 0;
  max-width: 144px;
  min-width: 96px;
  padding: 5px 7px 5px 6px;
  pointer-events: auto;
  position: absolute;
  text-align: left;
  transform: translateX(-50%);
}

.sensor-scale-callout::after {
  border-left: 5px solid transparent;
  border-right: 5px solid transparent;
  border-top: 6px solid var(--card-background-color);
  bottom: -6px;
  content: "";
  height: 0;
  left: 50%;
  position: absolute;
  transform: translateX(-50%);
  width: 0;
}

.sensor-scale-callout-marker.shifted .sensor-scale-callout::after {
  display: none;
}

.sensor-scale-callout small,
.sensor-scale-callout strong,
.sensor-scale-bounds span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sensor-scale-callout small {
  color: var(--secondary-text-color);
  font-size: 10px;
  line-height: 1.15;
}

.sensor-scale-callout strong {
  color: var(--primary-text-color);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.15;
}

.sensor-scale-value-row {
  align-items: center;
  display: inline-flex;
  gap: 5px;
  min-width: 0;
  overflow: visible;
  white-space: nowrap;
}

.sensor-scale-offset {
  align-items: center;
  color: var(--primary-color);
  display: inline-flex;
  font-size: 10px;
  font-weight: 700;
  gap: 3px;
  line-height: 1.1;
  min-width: 0;
  overflow: visible;
  white-space: nowrap;
}

.sensor-scale-offset-help {
  align-items: center;
  color: var(--secondary-text-color);
  cursor: help;
  display: inline-flex;
  flex: 0 0 auto;
  outline: none;
  overflow: visible;
  position: relative;
}

.sensor-scale-offset-help ha-icon {
  --mdc-icon-size: 12px;
}

.sensor-scale-offset-tooltip {
  background: var(--primary-text-color);
  border-radius: 6px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.22);
  color: var(--primary-background-color);
  font-size: 11px;
  font-weight: 400;
  left: 50%;
  line-height: 1.35;
  max-width: min(220px, calc(100vw - 40px));
  opacity: 0;
  padding: 7px 8px;
  pointer-events: none;
  position: absolute;
  top: calc(100% + 6px);
  transform: translateX(-50%);
  transition: opacity 120ms ease, visibility 120ms ease;
  visibility: hidden;
  white-space: normal;
  width: max-content;
  z-index: 30;
}

.sensor-scale-callout-marker.edge-left .sensor-scale-offset-tooltip {
  left: 0;
  transform: none;
}

.sensor-scale-callout-marker.edge-right .sensor-scale-offset-tooltip {
  left: auto;
  right: 0;
  transform: none;
}

.sensor-scale-offset-help:hover .sensor-scale-offset-tooltip,
.sensor-scale-offset-help:focus .sensor-scale-offset-tooltip,
.sensor-scale-offset-help:focus-visible .sensor-scale-offset-tooltip {
  opacity: 1;
  visibility: visible;
}

.sensor-scale-dot {
  background: var(--card-background-color);
  border: 3px solid var(--secondary-text-color);
  border-radius: 50%;
  box-shadow: 0 0 0 2px var(--card-background-color);
  height: 12px;
  left: 0;
  position: absolute;
  top: 0;
  transform: translate(-50%, -50%);
  width: 12px;
}

.sensor-scale-marker.marker-target .sensor-scale-dot {
  background: var(--error-color, #d93025);
  border-color: var(--error-color, #d93025);
  height: 14px;
  width: 14px;
}

.sensor-scale-callout-marker.marker-target .sensor-scale-callout {
  border-left-color: var(--error-color, #d93025);
}

.sensor-scale-marker.marker-room .sensor-scale-dot {
  border-color: var(--success-color, #43a047);
}

.sensor-scale-callout-marker.marker-room .sensor-scale-callout {
  border-left-color: var(--success-color, #43a047);
}

.sensor-scale-marker.marker-climateTarget .sensor-scale-dot {
  border-color: var(--primary-color);
}

.sensor-scale-callout-marker.marker-climateTarget .sensor-scale-callout {
  border-left-color: var(--primary-color);
}

.sensor-scale-marker.marker-climate .sensor-scale-dot {
  border-color: var(--secondary-text-color);
}

.sensor-scale-marker .sensor-scale-dot.segmented {
  background: var(--sensor-scale-dot-segments, var(--secondary-text-color));
  border: 0;
  height: 16px;
  width: 16px;
}

.sensor-scale-marker .sensor-scale-dot.segmented::after {
  background: var(--card-background-color);
  border-radius: 50%;
  content: "";
  inset: 4px;
  position: absolute;
}

.sensor-scale-callout-marker.marker-climate .sensor-scale-callout {
  border-left-color: var(--secondary-text-color);
}

.sensor-scale-bounds {
  color: var(--secondary-text-color);
  font-size: 11px;
}

.sensor-scale-bounds {
  display: flex;
  justify-content: space-between;
  min-width: 640px;
}

.sensor-idle-state {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  color: var(--secondary-text-color);
  display: grid;
  font-size: 13px;
  gap: 8px;
  grid-template-columns: 20px minmax(0, 1fr);
  line-height: 1.35;
  padding: 12px;
}

.sensor-idle-state ha-icon {
  --mdc-icon-size: 19px;
  color: var(--secondary-text-color);
}

.sensor-selected-entity {
  color: var(--secondary-text-color);
  display: block;
  font-size: 11px;
  margin-top: 4px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 720px) {
  .sensor-zone-heading {
    align-items: center;
    grid-template-columns: minmax(0, 1fr) auto;
  }

  .sensor-zone-actions {
    justify-content: flex-end;
  }

  .sensor-config-row {
    align-items: stretch;
    grid-template-columns: minmax(0, 1fr);
  }

  .sensor-block-summary {
    grid-template-columns: minmax(0, 1fr);
  }

}
`, sn = u`
.settings-view {
  display: grid;
  gap: 12px;
  margin-top: 0;
  min-width: 0;
}

.settings-field,
.settings-zone-order,
.settings-portability,
.settings-maintenance,
.settings-reset,
.settings-startup,
.settings-temperature {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  min-width: 0;
  padding: 12px;
}

.settings-field {
  display: block;
}

.settings-startup {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: 36px minmax(0, 1fr) auto;
}

.settings-temperature {
  align-items: start;
  display: grid;
  gap: 12px;
  grid-template-columns: 36px minmax(0, 1fr) auto;
}

.settings-temperature.migration-required {
  border-color: var(--warning-color, #c99500);
}

.settings-temperature-copy {
  min-width: 0;
}

.settings-temperature-copy > p,
.temperature-migration-action p {
  color: var(--secondary-text-color);
  font-size: 12px;
  margin: 4px 0 0;
}

.settings-temperature-value {
  align-self: center;
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 999px;
  font-size: 16px;
  padding: 7px 12px;
}

.temperature-migration-action {
  border-top: 1px solid var(--divider-color);
  margin-top: 12px;
  padding-top: 12px;
}

.temperature-migration-buttons {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 10px;
}

.temperature-migration-buttons .command-button {
  width: auto;
}

.settings-startup ha-switch {
  justify-self: end;
}

.settings-startup-icon {
  --mdc-icon-size: 24px;
  color: var(--primary-color);
  justify-self: center;
}

.settings-startup-copy {
  min-width: 0;
}

.settings-maintenance {
  display: grid;
  gap: 12px;
}

.maintenance-grid {
  display: grid;
  gap: 10px;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  min-width: 0;
}

.maintenance-item {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 4px;
  min-width: 0;
  padding: 10px;
}

.maintenance-item strong {
  color: var(--primary-text-color);
  font-size: 14px;
  min-width: 0;
  overflow-wrap: anywhere;
}

.settings-reset {
  align-items: center;
  display: grid;
  gap: 12px;
  grid-template-columns: 36px minmax(0, 1fr) auto;
}

.settings-reset-icon {
  --mdc-icon-size: 24px;
  color: var(--error-color);
  justify-self: center;
}

.settings-reset-copy {
  min-width: 0;
}

.settings-reset .command-button {
  justify-self: end;
  width: auto;
}

.section-label {
  color: var(--primary-text-color);
  display: block;
  font-weight: 600;
}

.settings-zone-order p,
.settings-maintenance p,
.settings-reset p,
.settings-startup p {
  color: var(--secondary-text-color);
  font-size: 12px;
  margin: 4px 0 0;
}

.settings-zone-order > .section-heading {
  grid-template-columns: 36px minmax(0, 1fr);
}

.settings-zone-list {
  display: grid;
  gap: 8px;
  margin-top: 10px;
  min-width: 0;
}

.settings-zone-row {
  align-items: start;
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 8px;
  grid-template-columns: 24px minmax(0, 1fr) auto;
  min-width: 0;
  padding: 10px;
}

.settings-drag-handle {
  align-items: center;
  background: transparent;
  border: 0;
  color: var(--secondary-text-color);
  cursor: grab;
  display: inline-flex;
  height: 28px;
  justify-content: center;
  margin: -2px;
  padding: 0;
  width: 28px;
}

.settings-drag-handle:active {
  cursor: grabbing;
}

.settings-drag-handle ha-icon {
  --mdc-icon-size: 18px;
}

.settings-zone-main {
  align-items: start;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(150px, 0.75fr) minmax(220px, 1.25fr) minmax(240px, 1fr);
  min-width: 0;
}

.settings-zone-identity {
  display: grid;
  gap: 2px;
  min-width: 0;
}

.settings-zone-title {
  align-items: center;
  display: grid;
  gap: 7px;
  grid-template-columns: 10px minmax(0, 1fr);
  min-width: 0;
}

.settings-zone-identity strong,
.settings-zone-identity span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.settings-zone-identity span {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.settings-diagnostic-dot {
  border-radius: 50%;
  display: inline-block;
  height: 8px;
  width: 8px;
}

.settings-diagnostic-dot.ok {
  background: var(--success-color, #2e7d32);
}

.settings-diagnostic-dot.warning {
  background: var(--warning-color, #c99500);
}

.settings-diagnostic-dot.error {
  background: var(--error-color, #c62828);
}

.settings-zone-identity .settings-diagnostic-text {
  white-space: normal;
}

.settings-zone-identity .settings-feature-badge {
  align-items: center;
  background: color-mix(in srgb, var(--primary-color) 12%, var(--card-background-color));
  border: 1px solid color-mix(in srgb, var(--primary-color) 34%, var(--divider-color));
  border-radius: 999px;
  color: var(--primary-text-color);
  display: inline-flex;
  font-size: 11px;
  gap: 4px;
  justify-self: start;
  line-height: 1;
  margin-top: 4px;
  max-width: 100%;
  padding: 4px 7px;
  white-space: nowrap;
}

.settings-feature-badge ha-icon {
  --mdc-icon-size: 14px;
  color: var(--primary-color);
  flex: 0 0 auto;
}

.settings-diagnostic-text.warning {
  color: var(--warning-color, #c99500);
}

.settings-diagnostic-text.error {
  color: var(--error-color, #c62828);
}

.settings-entity-status.ok {
  color: var(--success-color, #2e7d32);
}

.settings-entity-status.warning {
  color: var(--error-color, #c62828);
}

.settings-capability-section {
  display: grid;
  gap: 4px;
  min-width: 0;
}

.settings-mode-tags,
.settings-data-icons,
.settings-facts,
.settings-capability-composite {
  align-items: center;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  min-width: 0;
}

.settings-capability-composite {
  align-items: flex-start;
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(150px, auto) minmax(90px, 1fr);
}

.settings-facts span {
  align-items: center;
  color: var(--secondary-text-color);
  display: inline-flex;
  font-size: 12px;
  gap: 4px;
  min-width: 0;
}

.settings-facts .capability-not-reported {
  color: var(--secondary-text-color);
}

.settings-facts ha-icon,
.settings-data-icons ha-icon {
  --mdc-icon-size: 16px;
  color: var(--secondary-text-color);
}

.settings-data-icons span {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 999px;
  display: inline-flex;
  height: 26px;
  justify-content: center;
  width: 26px;
}

.mode-chip {
  background: var(--timeline-bg, color-mix(in srgb, var(--primary-color) 12%, var(--card-background-color)));
  border: 1px solid var(--timeline-border, color-mix(in srgb, var(--primary-color) 36%, var(--divider-color)));
  border-radius: 999px;
  color: var(--primary-text-color);
  display: inline-flex;
  font-size: 12px;
  line-height: 1;
  padding: 5px 8px;
  white-space: nowrap;
}

.mode-chip.mode-heat {
  --timeline-bg: color-mix(in srgb, #d95f24 18%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, #d95f24 48%, var(--divider-color));
}

.mode-chip.mode-cool {
  --timeline-bg: color-mix(in srgb, #2d7dd2 18%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, #2d7dd2 48%, var(--divider-color));
}

.mode-chip.mode-heat-cool {
  --timeline-bg: color-mix(in srgb, #6f7f91 16%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, #6f7f91 45%, var(--divider-color));
}

.mode-chip.mode-auto {
  --timeline-bg: color-mix(in srgb, #6f7f91 18%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, #6f7f91 45%, var(--divider-color));
}

.mode-chip.mode-dry {
  --timeline-bg: color-mix(in srgb, #b4872b 16%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, #b4872b 42%, var(--divider-color));
}

.mode-chip.mode-fan-only {
  --timeline-bg: color-mix(in srgb, #2f8f83 16%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, #2f8f83 42%, var(--divider-color));
}

.mode-chip.mode-off {
  --timeline-bg: color-mix(in srgb, var(--disabled-text-color) 16%, var(--card-background-color));
  --timeline-border: color-mix(in srgb, var(--disabled-text-color) 42%, var(--divider-color));
}

.settings-row-actions {
  display: inline-flex;
  gap: 4px;
}

.settings-row-actions .icon-button {
  height: 34px;
  width: 34px;
}
`, cn = u`
.template-library {
  display: grid;
  gap: 12px;
  margin-top: 0;
  min-width: 0;
}

.template-detail-heading {
  align-items: center;
  display: flex;
  gap: 12px;
  justify-content: space-between;
  min-width: 0;
}

.template-name-field {
  min-width: 0;
}

.template-item strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-library-layout {
  align-items: start;
  display: grid;
  gap: 12px;
  grid-template-columns: minmax(220px, 0.85fr) minmax(0, 1.65fr);
  min-width: 0;
}

.template-list-wrap,
.template-detail {
  background: var(--secondary-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  min-width: 0;
  padding: 12px;
}

.template-list-wrap {
  min-height: 0;
  position: relative;
}

.template-list-heading {
  align-items: center;
  display: flex;
  gap: 10px;
  justify-content: space-between;
  margin-bottom: 10px;
  min-width: 0;
}

.template-list-heading strong {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.template-list-heading .section-heading {
  flex: 1 1 auto;
}

.template-list-heading .icon-button {
  height: 34px;
  margin-right: 14px;
  width: 34px;
}

.template-list,
.template-block-list {
  display: grid;
  gap: 8px;
}

.template-item {
  align-items: center;
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  color: var(--primary-text-color);
  display: grid;
  gap: 8px;
  grid-template-columns: minmax(0, 1fr) 40px;
  min-width: 0;
  padding: 8px;
}

.template-item-main {
  background: transparent;
  border: 0;
  color: inherit;
  cursor: pointer;
  display: grid;
  gap: 3px;
  min-width: 0;
  padding: 2px;
  text-align: left;
}

.template-item-main span,
.template-block small {
  color: var(--secondary-text-color);
  font-size: 12px;
}

.template-item .icon-button.danger.template-item-delete {
  background: transparent;
  border-color: transparent;
  color: var(--error-color, #c62828);
  height: 34px;
  width: 34px;
}

.template-item .icon-button.danger.template-item-delete:hover {
  background: color-mix(in srgb, var(--error-color, #c62828) 10%, transparent);
  border-color: transparent;
  color: var(--error-color, #c62828);
}

.template-item.active {
  background: color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color));
  border-color: color-mix(in srgb, var(--primary-color) 50%, var(--divider-color));
}

.template-detail {
  align-content: start;
  align-self: start;
  display: grid;
  gap: 12px;
}

.template-placeholder.compact {
  align-items: center;
  background: var(--secondary-background-color);
  border: 1px dashed var(--divider-color);
  border-radius: 8px;
  color: var(--secondary-text-color);
  display: grid;
  font-size: 14px;
  font-weight: 600;
  gap: 10px;
  grid-template-columns: minmax(0, 1fr);
  justify-items: center;
  line-height: 1.35;
  min-height: 64px;
  min-width: 0;
  padding: 12px 56px;
  position: relative;
  text-align: center;
}

.template-placeholder.compact span {
  min-width: 0;
}

.template-placeholder.compact > .icon-button {
  position: absolute;
  right: 12px;
  top: 50%;
  transform: translateY(-50%);
}

.template-editor {
  margin-top: 0;
}

.template-editor .editor-actions {
  grid-template-columns: repeat(2, minmax(0, 180px));
  justify-content: end;
}

.template-detail-actions {
  display: flex;
  flex: 0 0 auto;
  gap: 8px;
  justify-content: flex-end;
  margin-right: 14px;
}

.template-apply-button {
  padding: 0 12px;
  width: auto;
}

.template-name-field {
  display: block;
  width: 100%;
}

.template-name-input-wrap {
  align-items: center;
  display: grid;
  gap: 8px;
  grid-template-columns: 20px minmax(0, 1fr);
  min-width: 0;
}

.template-name-input-wrap ha-icon {
  --mdc-icon-size: 18px;
  color: var(--secondary-text-color);
}

.template-apply-panel {
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 12px;
  min-width: 0;
  overflow: hidden;
  padding: 10px;
}

.template-apply-scroll-wrap {
  min-width: 0;
  overflow: auto;
  padding-bottom: 8px;
  position: relative;
  scrollbar-gutter: stable;
}

.template-apply-grid {
  display: grid;
  grid-template-columns: minmax(104px, 148px) repeat(7, minmax(62px, 1fr));
  min-width: 548px;
}

.template-apply-cell {
  align-items: center;
  border-bottom: 1px solid var(--divider-color);
  border-right: 1px solid var(--divider-color);
  display: flex;
  justify-content: center;
  min-height: 42px;
  padding: 6px 8px;
}

.template-apply-cell.header {
  background: var(--secondary-background-color);
  color: var(--secondary-text-color);
  font-size: 12px;
  font-weight: 700;
  text-transform: uppercase;
}

.template-apply-zone {
  background: var(--card-background-color);
  justify-content: flex-start;
  left: 0;
  min-width: 0;
  overflow-wrap: anywhere;
  position: sticky;
  white-space: normal;
  z-index: 3;
}

.template-apply-zone.header {
  z-index: 5;
}

.template-apply-day {
  cursor: pointer;
}

.template-apply-day input {
  height: 18px;
  margin: 0;
  width: 18px;
}

.template-block {
  align-items: center;
  background: var(--card-background-color);
  border: 1px solid var(--divider-color);
  border-radius: 8px;
  display: grid;
  gap: 12px;
  grid-template-columns: 72px minmax(0, 1fr);
  padding: 10px;
}

.template-block span,
.template-block small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
`, ln = u`
  .timeline-panel {
    display: grid;
    gap: 8px;
    margin: 12px 0;
  }

  .timeline-header {
    display: grid;
    gap: 6px;
  }

  .timeline-hours {
    color: var(--secondary-text-color);
    font-size: 11px;
    min-height: 22px;
    position: relative;
  }

  .timeline-hours > span {
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    z-index: 1;
  }

  .timeline-hours > span:nth-of-type(1) {
    left: 0;
    transform: translateY(-50%);
  }

  .timeline-hours > span:nth-of-type(2) {
    left: 25%;
  }

  .timeline-hours > span:nth-of-type(3) {
    left: 50%;
  }

  .timeline-hours > span:nth-of-type(4) {
    left: 75%;
  }

  .timeline-hours > span:nth-of-type(5) {
    left: 100%;
    transform: translate(-100%, -50%);
  }

  .timeline-track {
    background:
      linear-gradient(to right, var(--divider-color) 1px, transparent 1px) 0 0 / 25% 100%,
      var(--card-background-color);
    border: 1px solid var(--divider-color);
    border-radius: 8px;
    min-height: 76px;
    overflow: hidden;
    position: relative;
  }

  .timeline-now-marker {
    bottom: 0;
    left: 0;
    pointer-events: none;
    position: absolute;
    right: 0;
    top: 0;
    z-index: 2;
  }

  .timeline-now-marker::before {
    background: color-mix(in srgb, var(--primary-color) 82%, var(--card-background-color));
    border-radius: 999px;
    content: "";
    height: 22px;
    left: var(--timeline-now-left);
    position: absolute;
    top: 50%;
    transform: translateX(-50%);
    width: 2px;
  }

  .timeline-now-marker span {
    background: color-mix(in srgb, var(--card-background-color) 84%, var(--primary-color) 16%);
    border: 1px solid color-mix(in srgb, var(--primary-color) 58%, var(--divider-color));
    border-radius: 999px;
    color: var(--primary-text-color);
    font-size: 10px;
    font-weight: 600;
    left: clamp(26px, var(--timeline-now-left), calc(100% - 26px));
    line-height: 1;
    padding: 2px 5px;
    position: absolute;
    top: 50%;
    transform: translate(-50%, -50%);
    white-space: nowrap;
  }

  .timeline-block {
    align-items: start;
    background: var(--timeline-bg, color-mix(in srgb, var(--primary-color) 20%, var(--card-background-color)));
    border: 1px solid var(--timeline-border, color-mix(in srgb, var(--primary-color) 48%, var(--divider-color)));
    border-radius: 8px;
    box-sizing: border-box;
    color: var(--primary-text-color);
    cursor: grab;
    display: grid;
    gap: 1px;
    height: calc(100% - 12px);
    justify-items: start;
    left: 0;
    min-width: 0;
    overflow: hidden;
    padding: 8px 12px;
    position: absolute;
    text-align: left;
    top: 6px;
    user-select: none;
  }

  .timeline-block.compact {
    gap: 0;
    padding: 8px 10px;
  }

  .timeline-block.tiny {
    padding: 8px 6px;
  }

  .timeline-block.mode-heat,
  .overview-timeline-block.mode-heat,
  .overview-timeline-boost.mode-heat {
    --timeline-bg: color-mix(in srgb, #d95f24 18%, var(--card-background-color));
    --timeline-border: color-mix(in srgb, #d95f24 48%, var(--divider-color));
    --timeline-handle: #d95f24;
  }

  .timeline-block.mode-cool,
  .overview-timeline-block.mode-cool,
  .overview-timeline-boost.mode-cool {
    --timeline-bg: color-mix(in srgb, #2d7dd2 18%, var(--card-background-color));
    --timeline-border: color-mix(in srgb, #2d7dd2 48%, var(--divider-color));
    --timeline-handle: #2d7dd2;
  }

  .timeline-block.mode-heat-cool,
  .overview-timeline-block.mode-heat-cool {
    background:
      linear-gradient(
        90deg,
        color-mix(in srgb, #d95f24 16%, var(--card-background-color)),
        color-mix(in srgb, #2d7dd2 16%, var(--card-background-color))
      );
    --timeline-border: color-mix(in srgb, #6f7f91 45%, var(--divider-color));
    --timeline-handle: #6f7f91;
  }

  .overview-timeline-boost.mode-heat-cool {
    --timeline-border: color-mix(in srgb, #6f7f91 45%, var(--divider-color));
    --timeline-handle: #6f7f91;
  }

  .timeline-block.mode-auto,
  .overview-timeline-block.mode-auto,
  .overview-timeline-boost.mode-auto {
    --timeline-bg: color-mix(in srgb, #6f7f91 18%, var(--card-background-color));
    --timeline-border: color-mix(in srgb, #6f7f91 45%, var(--divider-color));
    --timeline-handle: #6f7f91;
  }

  .timeline-block.mode-dry,
  .overview-timeline-block.mode-dry,
  .overview-timeline-boost.mode-dry {
    --timeline-bg: color-mix(in srgb, #b4872b 16%, var(--card-background-color));
    --timeline-border: color-mix(in srgb, #b4872b 42%, var(--divider-color));
    --timeline-handle: #b4872b;
  }

  .timeline-block.mode-fan,
  .overview-timeline-block.mode-fan,
  .overview-timeline-boost.mode-fan {
    --timeline-bg: color-mix(in srgb, #2f8f83 16%, var(--card-background-color));
    --timeline-border: color-mix(in srgb, #2f8f83 42%, var(--divider-color));
    --timeline-handle: #2f8f83;
  }

  .timeline-block.mode-keep,
  .overview-timeline-block.mode-keep,
  .overview-timeline-boost.mode-keep {
    --timeline-bg: color-mix(in srgb, var(--primary-color) 14%, var(--card-background-color));
    --timeline-border: color-mix(in srgb, var(--primary-color) 38%, var(--divider-color));
    --timeline-handle: var(--primary-color);
  }

  .timeline-resize-handle {
    bottom: 0;
    cursor: ew-resize;
    pointer-events: auto;
    position: absolute;
    top: 0;
    width: 10px;
    z-index: 1;
  }

  .timeline-resize-handle::after {
    background: color-mix(in srgb, var(--timeline-handle, var(--primary-color)) 72%, var(--card-background-color));
    border-radius: 999px;
    bottom: 10px;
    content: "";
    position: absolute;
    top: 10px;
    width: 3px;
  }

  .timeline-resize-handle.left {
    left: 0;
  }

  .timeline-resize-handle.left::after {
    left: 3px;
  }

  .timeline-resize-handle.right {
    right: 0;
  }

  .timeline-resize-handle.right::after {
    right: 3px;
  }

  .timeline-block:active {
    cursor: grabbing;
  }

  .timeline-block:active strong,
  .timeline-block:active span,
  .timeline-block:active small {
    cursor: grabbing;
  }

  .timeline-block:active .timeline-resize-handle {
    cursor: ew-resize;
  }

  .timeline-block.off,
  .overview-timeline-block.mode-off,
  .overview-timeline-boost.mode-off {
    --timeline-bg: color-mix(in srgb, var(--secondary-text-color) 14%, var(--card-background-color));
    --timeline-border: var(--divider-color);
    --timeline-handle: var(--secondary-text-color);
  }

  .timeline-block strong,
  .timeline-block span,
  .timeline-block small {
    cursor: inherit;
    display: block;
    max-width: 100%;
    overflow: hidden;
    pointer-events: none;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .timeline-block strong {
    font-size: 12px;
  }

  .timeline-block span,
  .timeline-block small {
    font-size: 11px;
  }

  .timeline-block.compact span,
  .timeline-block.compact small {
    display: none;
  }

  .timeline-block.tiny strong {
    font-size: 0;
  }

  .timeline-block.tiny strong::after {
    content: "...";
    font-size: 11px;
  }

  .timeline-empty {
    left: 12px;
    position: absolute;
    top: 12px;
  }
`, un = u`
  @media (max-width: 900px) {
    .template-library-layout {
      grid-template-columns: minmax(0, 1fr);
      max-width: 100%;
      min-width: 0;
    }

    .template-detail,
    .template-list-wrap,
    .template-apply-panel,
    .template-editor,
    .template-block-list {
      min-width: 0;
      max-width: 100%;
    }
  }

  @container (max-width: 900px) {
    .template-library-layout {
      grid-template-columns: minmax(0, 1fr);
      max-width: 100%;
      min-width: 0;
    }

    .template-detail,
    .template-list-wrap,
    .template-apply-panel,
    .template-editor,
    .template-block-list {
      min-width: 0;
      max-width: 100%;
    }
  }

  @container (max-width: 760px) {
    .overview-timeline-empty {
      bottom: auto;
      height: 100%;
      left: calc(var(--overview-timeline-name-column) + 10px);
      position: sticky;
      top: 0;
    }

    .overview-timeline-block,
    .overview-timeline-boost,
    .overview-timeline-pause {
      overflow: visible;
    }

    .overview-timeline-block-main {
      left: calc(var(--overview-timeline-name-column) + 12px);
      max-width: min(150px, calc(100vw - var(--overview-timeline-name-column) - 32px));
      position: sticky;
    }

    .next .event {
      grid-template-columns: minmax(110px, 150px) max-content;
      min-width: max-content;
    }

    .next .event-details,
    .next .event-details.preconditioned {
      grid-template-columns: 18ch 8ch 12ch;
    }

    .next .event-list.has-preconditioning .event-details,
    .next .event-list.has-preconditioning .event-details.preconditioned {
      grid-template-columns: 40ch 8ch 12ch;
    }

    .next .event-time {
      justify-content: flex-start;
    }

    .next .event-list.has-preconditioning .event-time-flow {
      display: grid;
      grid-template-columns: 16px 17ch 16px 17ch;
      justify-content: start;
    }

    .next .event-list.has-preconditioning .event-time-single .target-time {
      grid-column: 4;
    }

    .next .event-identity {
      align-items: center;
      align-self: stretch;
      background: var(--secondary-background-color);
      box-shadow: 1px 0 0 var(--divider-color);
      display: flex;
      left: 0;
      padding-right: 10px;
      position: sticky;
      z-index: 4;
    }

    .settings-zone-main {
      grid-template-columns: minmax(0, 1fr);
    }

    .settings-capability-composite {
      grid-template-columns: minmax(0, 1fr);
    }

    .preconditioning-config-sections,
    .preconditioning-directions {
      grid-template-columns: minmax(0, 1fr);
    }

    .settings-capability-row {
      align-items: start;
      display: grid;
      gap: 8px;
      grid-template-columns: minmax(104px, 0.8fr) minmax(0, 1fr);
    }

    .settings-capability-row > .label {
      padding-top: 6px;
    }

    .settings-capability-row .settings-data-icons,
    .settings-capability-row .settings-facts,
    .settings-capability-row .settings-mode-tags {
      justify-content: flex-end;
    }

    .settings-startup {
      grid-template-columns: 32px minmax(0, 1fr) auto;
    }

    .portability-grid {
      grid-template-columns: minmax(0, 1fr);
    }

    .maintenance-grid {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }
  }

  @container (max-width: 600px) {
    .preconditioning-zone-heading {
      align-items: center;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .preconditioning-zone-actions {
      align-items: center;
      justify-content: flex-end;
    }

    .preconditioning-enable-control.unavailable {
      justify-content: flex-end;
    }

    .preconditioning-unavailable-message {
      display: block;
      grid-column: 1 / -1;
      text-align: right;
    }

    .preconditioning-config-row,
    .preconditioning-sensor-row {
      grid-template-columns: minmax(0, 1fr) minmax(110px, 42%);
    }

    .preconditioning-learning-summary {
      grid-template-columns: minmax(0, 1fr);
    }

    .preconditioning-block-preview {
      grid-template-columns: minmax(94px, 0.72fr) minmax(146px, 1.28fr);
      min-width: 0;
    }

    .preconditioning-block-preview.normal-start {
      grid-template-columns: minmax(0, 1fr);
    }

    .preconditioning-calculation-row.context {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .preconditioning-calculation-item.samples {
      grid-column: 1 / -1;
    }

    .preconditioning-help {
      position: static;
    }

    .preconditioning-help-tooltip {
      left: 0;
      max-width: none;
      right: 0;
      top: calc(100% - 2px);
      transform: none;
      width: auto;
    }
  }

  @media (max-width: 600px) {
    ha-card {
      --ha-card-background: transparent;
      --ha-card-border-width: 0;
      --ha-card-box-shadow: none;
      background: transparent;
      border: 0;
      box-shadow: none;
    }

    .card {
      padding: 0;
    }

    .portability-export-card {
      display: none;
    }

    .maintenance-grid,
    .preconditioning-config-sections,
    .preconditioning-directions,
    .settings-reset {
      grid-template-columns: minmax(0, 1fr);
    }

    .preconditioning-zone-heading {
      align-items: center;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .preconditioning-zone-actions {
      align-items: center;
      justify-content: flex-end;
    }

    .preconditioning-enable-control.unavailable {
      justify-content: flex-end;
    }

    .preconditioning-unavailable-message {
      display: block;
      grid-column: 1 / -1;
      text-align: right;
    }

    .preconditioning-config-row,
    .preconditioning-sensor-row {
      grid-template-columns: minmax(0, 1fr) minmax(110px, 42%);
    }

    .preconditioning-learning-summary {
      grid-template-columns: minmax(0, 1fr);
    }

    .preconditioning-block-preview {
      grid-template-columns: minmax(94px, 0.72fr) minmax(146px, 1.28fr);
      min-width: 0;
    }

    .preconditioning-block-preview.normal-start {
      grid-template-columns: minmax(0, 1fr);
    }

    .preconditioning-calculation-row.context {
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .preconditioning-calculation-item.samples {
      grid-column: 1 / -1;
    }

    .preconditioning-help {
      position: static;
    }

    .preconditioning-help-tooltip {
      left: 0;
      max-width: none;
      right: 0;
      top: calc(100% - 2px);
      transform: none;
      width: auto;
    }

    .settings-reset-icon {
      display: none;
    }

    .summary {
      grid-template-columns: 1fr;
    }

    .draft-list {
      grid-template-columns: minmax(66px, 0.9fr) minmax(76px, 1fr) minmax(62px, 0.7fr) 34px 34px;
    }

    .overview-status-heading {
      gap: 8px;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .overview-controls {
      justify-self: end;
    }

    .overview-pause-control {
      width: fit-content;
    }

    .overview-pause-input {
      --overview-pause-digits: 4ch;
      width: fit-content;
    }

    .event {
      min-width: 560px;
    }

    .scheduler-actions {
      right: 0;
      transform: none;
      grid-template-columns: 1fr;
      max-width: min(280px, calc(100vw - 48px));
      width: min(280px, calc(100vw - 48px));
    }

    .pause-action-group {
      grid-template-columns: 80px minmax(0, 1fr);
    }

    .pause-duration-field,
    .scheduler-actions .command-button {
      width: 100%;
    }

    .editor-header,
    .copy-header {
      align-items: stretch;
      flex-direction: column;
    }

    .schedule-zone-heading,
    .schedule-editor-heading {
      align-items: stretch;
      flex-direction: column;
    }

    .schedule-editor-badges {
      justify-content: flex-start;
    }

    .copy-targets {
      grid-template-columns: 1fr;
    }

    .template-panel {
      grid-template-columns: minmax(0, 1fr);
      justify-self: stretch;
      max-width: none;
      min-width: 0;
    }

    .schedule-config-row {
      grid-template-columns: minmax(0, 1fr);
      max-width: 100%;
      min-width: 0;
    }

    .schedule-config-row .template-panel,
    .schedule-config-row .schedule-block-actions {
      grid-column: auto;
      max-width: 100%;
      min-width: 0;
    }

    .draft-list,
    .template-list,
    .template-detail {
      max-width: 100%;
      min-width: 0;
    }

    .template-list-wrap.scrollable {
      padding: 20px 12px;
    }

    .template-list-wrap.scrollable.can-scroll-up::before,
    .template-list-wrap.scrollable.can-scroll-down::after {
      border-color: var(--secondary-text-color);
      border-style: solid;
      content: "";
      height: 9px;
      left: 50%;
      opacity: 0.8;
      pointer-events: none;
      position: absolute;
      width: 9px;
      z-index: 1;
    }

    .template-list-wrap.scrollable.can-scroll-up::before {
      border-width: 2px 0 0 2px;
      top: 54px;
      transform: translateX(-50%) rotate(45deg);
    }

    .template-list-wrap.scrollable.can-scroll-down::after {
      border-width: 0 2px 2px 0;
      bottom: 7px;
      transform: translateX(-50%) rotate(45deg);
    }

    .template-list-wrap.scrollable .template-list {
      max-height: min(326px, 58vh);
      overflow-y: auto;
      overscroll-behavior: contain;
      padding: 2px;
    }

    .template-detail-heading,
    .copy-header {
      align-items: stretch;
      flex-direction: column;
    }

    .template-apply-panel .copy-header {
      align-items: center;
      flex-direction: row;
    }

    .template-apply-panel .copy-header > div {
      min-width: 0;
    }

    .template-apply-panel .copy-header .command-button {
      flex: 0 0 auto;
      width: auto;
    }

    .editor-actions {
      grid-template-columns: 1fr;
    }

    .template-editor .editor-actions {
      grid-template-columns: 1fr;
    }

    .command-button {
      width: 100%;
    }

    .editable-block .icon-button {
      width: 34px;
    }

    .advanced-climate-options summary {
      height: 34px;
      width: 34px;
    }

    .advanced-climate-options-placeholder {
      height: 34px;
      width: 34px;
    }

    .settings-zone-row {
      grid-template-columns: 28px minmax(0, 1fr);
    }

    .settings-zone-row > .settings-drag-handle {
      grid-column: 1;
      grid-row: 1;
      justify-self: center;
    }

    .settings-zone-main {
      grid-column: 2;
      grid-row: 1 / span 2;
    }

    .settings-row-actions {
      align-items: center;
      flex-direction: column;
      grid-column: 1;
      grid-row: 2;
      justify-content: flex-start;
      justify-self: center;
    }
  }
`, dn = [
	$t,
	en,
	tn,
	nn,
	rn,
	an,
	on,
	sn,
	cn,
	ln,
	u`
    .temperature-migration-banner {
      align-items: start;
      background: color-mix(in srgb, var(--warning-color, #c99500) 12%, var(--card-background-color));
      border: 1px solid var(--warning-color, #c99500);
      border-radius: 8px;
      color: var(--primary-text-color);
      display: grid;
      gap: 10px;
      grid-template-columns: auto minmax(0, 1fr);
      margin-bottom: 12px;
      padding: 12px;
    }

    .temperature-migration-banner ha-icon {
      color: var(--warning-color, #c99500);
    }

    .temperature-migration-banner strong,
    .temperature-migration-banner span {
      display: block;
    }

    .temperature-migration-banner span {
      color: var(--secondary-text-color);
      font-size: 12px;
      margin-top: 3px;
    }

    .summary {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin: 0 0 16px;
    }

    .summary > div,
    .next,
    .editor {
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      padding: 12px;
    }

    .summary > div {
      min-width: 0;
      overflow: hidden;
      position: relative;
    }

    .summary > .summary-status {
      overflow: visible;
      z-index: 3;
    }

    .summary-status.paused {
      padding-bottom: 20px;
    }

    .summary-status-header {
      align-items: start;
      display: grid;
      gap: 8px;
      grid-template-columns: minmax(0, 1fr) auto;
    }

    .summary-events {
      overflow: visible;
    }

    .summary strong,
    .summary span,
    label span {
      display: block;
    }

    .next,
    .schedule,
    .zones {
      margin-top: 14px;
    }

    .schedule-zone-picker {
      display: grid;
      gap: 8px;
      margin-top: 0;
    }

    .schedule-zone-picker .zones {
      margin-top: 0;
    }

    .schedule-zone-heading,
    .schedule-editor-heading,
    .schedule-step-heading {
      align-items: center;
      display: flex;
      gap: 12px;
      justify-content: space-between;
      min-width: 0;
    }

    .schedule-zone-heading > div,
    .schedule-editor-heading > div:first-child {
      min-width: 0;
    }

    .schedule-zone-heading strong,
    .schedule-editor-heading h2,
    .schedule-editor-entity {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .schedule-editor-heading {
      margin-top: 16px;
    }

    .schedule-step-heading {
      margin-top: 14px;
    }

    .schedule-step-heading strong,
    .schedule-editor-heading strong {
      font-size: 14px;
      font-weight: 600;
      min-width: 0;
    }

    .schedule-editor-entity {
      color: var(--secondary-text-color);
      display: block;
      font-size: 12px;
      margin-top: 2px;
    }

    .schedule-editor-badges {
      align-items: center;
      display: flex;
      flex: 0 0 auto;
      flex-wrap: wrap;
      gap: 8px;
      justify-content: flex-end;
    }

    .zones {
      display: flex;
      gap: 8px;
      overflow-x: auto;
      padding-bottom: 8px;
      scrollbar-gutter: stable;
    }

    .day-tabs {
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(56px, 1fr));
      padding-bottom: 2px;
    }

    .zone,
    .day-tab {
      background: transparent;
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      color: var(--primary-text-color);
      cursor: pointer;
      min-height: 40px;
      padding: 8px 12px;
    }

    .zone {
      flex: 0 0 auto;
      position: relative;
    }

    .zone.dirty::after {
      background: var(--warning-color, #f9a825);
      border: 2px solid var(--card-background-color);
      border-radius: 999px;
      content: "";
      height: 9px;
      position: absolute;
      right: -2px;
      top: -2px;
      width: 9px;
    }

    .zone.active,
    .day-tab.active {
      background: var(--primary-color);
      border-color: var(--primary-color);
      color: var(--text-primary-color);
    }

    .day-tab {
      align-items: center;
      display: grid;
      gap: 3px;
      justify-items: center;
      min-width: 0;
      padding: 8px 6px;
    }

    .day-tab span {
      max-width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .day-tab strong {
      background: color-mix(in srgb, var(--secondary-text-color) 14%, transparent);
      border-radius: 999px;
      font-size: 11px;
      line-height: 1;
      min-width: 18px;
      padding: 4px 6px;
    }

    .day-tabs,
    .editor {
      margin-top: 10px;
    }

    .copy-panel {
      border-top: 1px solid var(--divider-color);
      display: grid;
      gap: 10px;
      margin-top: 12px;
      padding-top: 12px;
    }

    .copy-targets {
      grid-template-columns: repeat(auto-fit, minmax(54px, 1fr));
    }

    .copy-targets.wide {
      grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
    }

    .copy-actions {
      display: flex;
      justify-content: flex-end;
    }

    .copy-actions .command-button {
      width: auto;
    }

    .scheduler-menu {
      justify-self: end;
      position: relative;
      z-index: 30;
    }

    .scheduler-menu summary {
      align-items: center;
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      color: var(--primary-text-color);
      cursor: pointer;
      display: inline-flex;
      height: 34px;
      justify-content: center;
      list-style: none;
      width: 34px;
    }

    .scheduler-menu summary::-webkit-details-marker {
      display: none;
    }

    .scheduler-menu summary:hover,
    .scheduler-menu[open] summary {
      background: color-mix(in srgb, var(--primary-color) 12%, var(--secondary-background-color));
      border-color: color-mix(in srgb, var(--primary-color) 38%, var(--divider-color));
    }

    .scheduler-menu summary ha-icon {
      --mdc-icon-size: 18px;
    }

    .scheduler-actions {
      align-items: stretch;
      background: color-mix(in srgb, var(--card-background-color) 94%, var(--primary-color) 6%);
      border: 1px solid color-mix(in srgb, var(--primary-color) 34%, var(--divider-color));
      border-radius: 8px;
      box-shadow: 0 12px 28px rgba(0, 0, 0, 0.28), var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.16));
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(0, 1fr);
      padding: 18px 12px 12px;
      position: absolute;
      right: 50%;
      top: calc(100% + 8px);
      transform: translateX(50%);
      width: 280px;
      z-index: 20;
    }

    .dialog-close {
      align-items: center;
      background: color-mix(in srgb, var(--card-background-color) 88%, var(--primary-color) 12%);
      border: 1px solid color-mix(in srgb, var(--primary-color) 26%, var(--divider-color));
      border-radius: 999px;
      color: var(--primary-text-color);
      cursor: pointer;
      display: inline-flex;
      height: 26px;
      justify-content: center;
      padding: 0;
      position: absolute;
      right: 8px;
      top: 8px;
      width: 26px;
      z-index: 1;
    }

    .dialog-close:hover {
      background: color-mix(in srgb, var(--primary-color) 18%, var(--card-background-color));
      border-color: color-mix(in srgb, var(--primary-color) 42%, var(--divider-color));
    }

    .dialog-close ha-icon {
      --mdc-icon-size: 18px;
    }

    .pause-action-group {
      align-items: end;
      background: color-mix(in srgb, var(--primary-text-color) 5%, var(--card-background-color));
      border: 1px solid color-mix(in srgb, var(--primary-text-color) 12%, var(--divider-color));
      border-radius: 8px;
      display: grid;
      gap: 10px;
      grid-template-columns: 80px minmax(0, 1fr);
      padding: 10px;
    }

    .pause-duration-field {
      width: 80px;
    }

    .scheduler-actions .command-button {
      min-width: 0;
      width: 100%;
    }

    .scheduler-actions .command-button span {
      overflow: visible;
      text-overflow: clip;
    }

    .scheduler-secondary-actions {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(2, minmax(0, 1fr));
    }

    .pause-progress {
      bottom: 0;
      border-bottom-left-radius: 8px;
      border-bottom-right-radius: 8px;
      display: grid;
      gap: 3px;
      left: 0;
      overflow: hidden;
      position: absolute;
      right: 0;
    }

    .pause-progress span {
      color: var(--secondary-text-color);
      display: block;
      font-size: 12px;
      line-height: 1.2;
      overflow: hidden;
      padding: 0 12px 2px;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .progress-track {
      background: color-mix(in srgb, var(--warning-color, #f9a825) 16%, var(--card-background-color));
      height: 4px;
      overflow: hidden;
    }

    .progress-fill {
      background: var(--warning-color, #f9a825);
      border-radius: inherit;
      height: 100%;
      transition: width 200ms ease;
    }

    .boost-status {
      align-items: center;
      background: color-mix(in srgb, var(--warning-color, #f9a825) 12%, var(--card-background-color));
      border: 1px solid color-mix(in srgb, var(--warning-color, #f9a825) 38%, var(--divider-color));
      border-radius: 8px;
      display: grid;
      gap: 10px;
      grid-template-columns: 24px minmax(0, 1fr);
      margin-top: 10px;
      padding: 10px 12px;
    }

    .boost-status ha-icon {
      color: var(--warning-color, #f9a825);
    }

    .boost-status span {
      color: var(--secondary-text-color);
      display: block;
      font-size: 12px;
      margin-top: 2px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .check-target {
      align-items: center;
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      cursor: pointer;
      display: flex;
      gap: 8px;
      min-height: 38px;
      padding: 8px 10px;
    }

    .copy-targets:not(.wide) .check-target {
      justify-content: center;
      padding: 8px 6px;
    }

    .copy-targets:not(.wide) .check-target.disabled {
      color: var(--disabled-text-color, var(--secondary-text-color));
      cursor: default;
      opacity: 0.52;
    }

    .copy-targets:not(.wide) .check-target input {
      height: 16px;
      margin: 0;
      width: 16px;
    }

    .copy-targets:not(.wide) .check-target span {
      font-size: 12px;
      line-height: 1;
    }

    .check-target input {
      accent-color: var(--primary-color);
      background: transparent;
      border: 0;
      height: auto;
      margin: 0;
      padding: 0;
      width: auto;
    }

    .template-panel {
      align-items: end;
      display: grid;
      gap: 10px;
      grid-template-columns: minmax(140px, 1fr);
      margin: 0;
      width: 100%;
    }

    .template-panel > div {
      min-width: 0;
    }

    .schedule-config-helper {
      color: var(--secondary-text-color);
      font-size: 12px;
      line-height: 1.35;
      margin-top: 12px;
    }

    .schedule-config-row {
      align-items: end;
      display: grid;
      gap: 12px;
      grid-template-columns: minmax(180px, 340px) minmax(24px, 1fr) auto;
      margin: 8px 0 12px;
      min-width: 0;
    }

    .schedule-config-row .template-panel {
      grid-column: 1;
    }

    .schedule-config-row .schedule-block-actions {
      grid-column: 3;
    }

    .editor-actions {
      display: grid;
      gap: 10px;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      margin-bottom: 12px;
      margin-top: 12px;
      width: 100%;
    }

    .editor-actions .command-button {
      width: 100%;
    }

    .schedule-block-actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      margin: 0;
      width: auto;
    }

    .schedule-block-actions .command-button {
      width: auto;
    }

    .template-editor .editor-actions {
      grid-template-columns: minmax(0, 180px);
    }

    .schedule-save-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      justify-content: flex-end;
      margin-top: 12px;
    }

    .schedule-save-actions .command-button {
      width: auto;
    }

    .schedule-copy-helper {
      color: var(--secondary-text-color);
      font-size: 12px;
      line-height: 1.35;
      margin-top: 14px;
    }

    .draft-list {
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      column-gap: 4px;
      display: grid;
      grid-template-columns: minmax(94px, 1fr) minmax(112px, 1fr) minmax(90px, 0.8fr) 40px 40px;
      overflow: visible;
      padding: 12px;
      row-gap: 10px;
    }

    .draft-list-header,
    .editable-block {
      display: contents;
    }

    .draft-add-row {
      align-items: center;
      display: flex;
      grid-column: 1 / -1;
      justify-content: center;
      min-width: 0;
      padding: 2px 0;
    }

    .draft-add-button {
      border-radius: 999px;
      flex: 0 0 auto;
      height: 34px;
      width: 34px;
    }

    .draft-add-button ha-icon {
      --mdc-icon-size: 18px;
    }

    .editable-block label {
      min-width: 0;
    }

    .editable-block > label > .label {
      display: none;
    }

    .editable-block .icon-button.danger {
      background: transparent;
      border-color: transparent;
      color: var(--error-color, #c62828);
      height: 38px;
      min-width: 0;
      padding: 0;
      width: 38px;
    }

    .editable-block .icon-button.danger:hover {
      background: color-mix(in srgb, var(--error-color, #c62828) 10%, transparent);
      border-color: transparent;
    }

    .editable-block input,
    .editable-block select {
      margin-top: 0;
    }

    .select-wrap {
      display: block;
      margin-top: 4px;
      position: relative;
    }

    .select-wrap select {
      appearance: none;
      margin-top: 0;
      padding-right: 24px;
    }

    .select-wrap::after {
      border: solid var(--secondary-text-color);
      border-radius: 1px;
      border-width: 0 2px 2px 0;
      content: "";
      height: 7px;
      pointer-events: none;
      position: absolute;
      right: 11px;
      top: 50%;
      transform: translateY(-62%) rotate(45deg);
      transition: transform 120ms ease;
      width: 7px;
    }

    .select-wrap:has(select:open)::after {
      transform: translateY(-28%) rotate(225deg);
    }

    .editable-block .select-wrap {
      margin-top: 0;
    }

    .advanced-climate-options {
      align-self: start;
      display: block;
      grid-column: auto;
      min-width: 0;
      position: relative;
      z-index: 8;
    }

    .advanced-climate-options-placeholder {
      display: block;
      height: 38px;
      width: 38px;
    }

    .advanced-climate-options[open] {
      z-index: 1000;
    }

    .advanced-climate-options summary {
      background: transparent;
      border-color: transparent;
      color: var(--secondary-text-color);
      height: 38px;
      list-style: none;
      min-width: 0;
      padding: 0;
      position: relative;
      width: 38px;
    }

    .advanced-climate-options summary::-webkit-details-marker {
      display: none;
    }

    .advanced-climate-options summary ha-icon {
      --mdc-icon-size: 18px;
      color: var(--primary-color);
    }

    .climate-options-badge {
      align-items: center;
      background: var(--primary-color);
      border: 2px solid var(--card-background-color);
      border-radius: 999px;
      color: var(--text-primary-color);
      display: inline-flex;
      font-size: 10px;
      font-weight: 700;
      height: 17px;
      justify-content: center;
      line-height: 1;
      min-width: 17px;
      padding: 0 4px;
      position: absolute;
      right: -5px;
      top: -6px;
    }

    .advanced-climate-options[open] summary {
      background: transparent;
      border-color: transparent;
      color: var(--primary-text-color);
    }

    .advanced-climate-options summary:hover {
      background: color-mix(in srgb, var(--primary-color) 10%, transparent);
      border-color: transparent;
    }

    .climate-options-scrim {
      -webkit-backdrop-filter: blur(1px);
      backdrop-filter: blur(1px);
      background: color-mix(in srgb, var(--primary-background-color, #000) 32%, transparent);
      border: 0;
      bottom: 0;
      cursor: default;
      display: block;
      left: 0;
      padding: 0;
      position: fixed;
      right: 0;
      top: 0;
      z-index: 1000;
    }

    .advanced-climate-options-fields {
      background: color-mix(in srgb, var(--card-background-color) 96%, var(--primary-color) 4%);
      border: 1px solid color-mix(in srgb, var(--primary-color) 28%, var(--divider-color));
      border-radius: 8px;
      box-shadow: 0 18px 42px rgba(0, 0, 0, 0.34), var(--ha-card-box-shadow, 0 2px 8px rgba(0, 0, 0, 0.16));
      box-sizing: border-box;
      display: grid;
      gap: 8px;
      grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
      margin: 0;
      max-height: min(560px, var(--climate-options-max-height, calc(100vh - 48px)));
      min-width: 0;
      overflow-y: auto;
      padding: 10px;
      position: fixed;
      left: var(--climate-options-left, 16px);
      top: var(--climate-options-top, 50%);
      transform: translateY(var(--climate-options-translate-y, 0));
      width: var(--climate-options-width, min(420px, calc(100vw - 32px)));
      z-index: 1001;
    }

    .advanced-climate-options-fields legend {
      background: var(--card-background-color);
      color: var(--secondary-text-color);
      font-size: 10px;
      font-weight: 700;
      line-height: 1;
      margin-left: 4px;
      padding: 0 5px;
      text-transform: uppercase;
    }

    .climate-options-inline-summary {
      align-self: start;
      background: color-mix(in srgb, var(--primary-color) 4%, transparent);
      border-radius: 0 0 6px 6px;
      border-top: 1px solid color-mix(in srgb, var(--primary-color) 18%, var(--divider-color));
      color: var(--secondary-text-color);
      display: block;
      font-size: 11px;
      grid-column: 1 / -1;
      line-height: 1.3;
      margin: -6px 0 4px;
      min-width: 0;
      overflow: hidden;
      padding: 6px 8px 3px 18px;
      position: relative;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .climate-options-inline-summary::before {
      background: color-mix(in srgb, var(--primary-color) 42%, transparent);
      border-radius: 999px;
      bottom: 5px;
      content: "";
      left: 8px;
      position: absolute;
      top: 6px;
      width: 2px;
    }

    input,
    select {
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      box-sizing: border-box;
      color: var(--primary-text-color);
      font: inherit;
      height: 38px;
      margin-top: 4px;
      padding: 6px 8px;
      width: 100%;
    }

    input:disabled,
    select:disabled {
      cursor: default;
      opacity: 0.55;
    }

    input.invalid {
      border-color: var(--error-color, #c62828);
      box-shadow: 0 0 0 1px var(--error-color, #c62828);
    }

    .field-error {
      color: var(--error-color, #c62828);
      display: block;
      font-size: 11px;
      margin-top: 4px;
    }

    .draft-list-header {
      color: var(--secondary-text-color);
      font-size: 11px;
      text-transform: uppercase;
    }

    .draft-list-header span {
      padding: 2px 8px 4px;
    }

    .mode,
    .pill {
      background: color-mix(in srgb, var(--primary-color) 12%, transparent);
      border-radius: 999px;
      color: var(--primary-text-color);
      display: inline-flex;
      justify-self: start;
      padding: 3px 8px;
      white-space: nowrap;
    }

    .pill.muted {
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
    }

    .pill.accent {
      background: color-mix(in srgb, var(--warning-color) 18%, transparent);
    }

    .pill.warning {
      background: color-mix(in srgb, var(--warning-color, #f9a825) 22%, transparent);
      border: 1px solid color-mix(in srgb, var(--warning-color, #f9a825) 60%, var(--divider-color));
      color: var(--primary-text-color);
    }

  `,
	un
], fn = class {
	constructor(e) {
		this.hass = e;
	}
	getSchedule() {
		return this.hass.connection.sendMessagePromise({ type: "velair/get_schedule" });
	}
	subscribeUpdates(e) {
		return this.hass.connection.subscribeMessage(e, { type: "velair/subscribe_updates" });
	}
	setDailySchedule(e, t, n) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/set_daily_schedule",
			entity_id: e,
			weekday: t,
			blocks: n
		});
	}
	clearSchedule(e, t) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/clear_schedule",
			entity_id: e,
			weekday: t
		});
	}
	copyDaySchedule(e, t, n) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/copy_day_schedule",
			entity_id: e,
			source_weekday: t,
			target_weekdays: n
		});
	}
	setScheduleTemplate(e, t, n) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/set_schedule_template",
			key: e,
			name: t,
			blocks: n
		});
	}
	deleteScheduleTemplate(e) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/delete_schedule_template",
			key: e
		});
	}
	pauseScheduler(e) {
		let t = e === void 0 ? void 0 : { duration_minutes: e };
		return this.hass.callService(Ye, "pause", t);
	}
	resumeScheduler() {
		return this.hass.callService(Ye, "resume");
	}
	updateSettings(e) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/update_settings",
			...e
		});
	}
	updateZonePreconditioning(e, t) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/update_zone_preconditioning",
			entity_id: e,
			preconditioning: t
		});
	}
	updateZoneComfort(e, t) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/update_zone_comfort",
			entity_id: e,
			comfort: t
		});
	}
	resetZonePreconditioningLearning(e, t) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/reset_zone_preconditioning_learning",
			entity_id: e,
			direction: t
		});
	}
	resetZonePreconditioningSettings(e) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/reset_zone_preconditioning_settings",
			entity_id: e
		});
	}
	exportData(e) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/export_data",
			sections: e
		});
	}
	importData(e, t) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/import_data",
			payload: e,
			sections: t
		});
	}
	resetData() {
		return this.hass.connection.sendMessagePromise({
			type: "velair/reset_data",
			confirmation: "reset"
		});
	}
	resolveTemperatureMigration(e, t, n) {
		return this.hass.connection.sendMessagePromise({
			type: "velair/resolve_temperature_migration",
			source_unit: e,
			migration_id: t,
			expected_revision: n
		});
	}
}, pn = /^\d{2}:\d{2}$/;
function mn(e) {
	if (!pn.test(e)) return;
	let [t, n] = e.split(":").map((e) => Number(e));
	if (!(t < 0 || t > 23 || n < 0 || n > 59)) return t * 60 + n;
}
function hn(e) {
	let t = Math.min(Math.max(e, 0), 1439), n = Math.floor(t / 60), r = t % 60;
	return `${String(n).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function gn(e) {
	let t = e ? mn(e) : void 0;
	if (t === void 0) return "08:00";
	let n = Math.floor(t / 60), r = t % 60, i = Math.min(n + 1, 23);
	return `${String(i).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function _n(e, t, n) {
	return Math.min(Math.max(e, t), Math.max(t, n));
}
//#endregion
//#region src/velair/domain/schedule-events.ts
function vn(e, t, n, r = /* @__PURE__ */ new Date()) {
	if (t?.enabled) {
		if (n) {
			let r = N(n.until);
			if (r) {
				let n = new Date(r);
				return bn(e, t, n) ?? yn(e, t, n);
			}
		}
		return yn(e, t, r);
	}
}
function yn(e, t, n) {
	let r;
	for (let i = 0; i <= 7; i += 1) {
		let a = new Date(n);
		a.setDate(n.getDate() + i);
		let o = Cn(a);
		for (let i of t.schedule?.[o] ?? []) {
			let t = Sn(a, i.start);
			if (!t || t <= n) continue;
			let s = xn(e, i, t, o);
			(!r || t < new Date(r.when)) && (r = s);
		}
	}
	return r;
}
function bn(e, t, n) {
	let r = Cn(n), i = n.getHours() * 60 + n.getMinutes(), a = [...t.schedule?.[r] ?? []].map((e) => ({
		block: e,
		minute: mn(e.start)
	})).filter((e) => e.minute !== void 0).sort((e, t) => e.minute - t.minute).filter((e) => e.minute <= i).at(-1)?.block;
	return a ? xn(e, a, n, r) : void 0;
}
function xn(e, t, n, r) {
	return {
		entity_id: e,
		when: n.toISOString(),
		action: t.action ?? "set_temperature",
		temperature: t.temperature ?? null,
		hvac_mode: t.hvac_mode ?? null,
		weekday: r,
		start: t.start
	};
}
function Sn(e, t) {
	let n = /^(\d{1,2}):(\d{2})$/.exec(t);
	if (!n) return;
	let r = Number(n[1]), i = Number(n[2]);
	if (r > 23 || i > 59) return;
	let a = new Date(e);
	return a.setHours(r, i, 0, 0), a;
}
function Cn(e) {
	return k[e.getDay() === 0 ? 6 : e.getDay() - 1];
}
function N(e) {
	if (typeof e != "string") return;
	let t = new Date(e).getTime();
	return Number.isNaN(t) ? void 0 : t;
}
function wn(e, t) {
	let n = new Map(e.map((e) => [e.entity_id, e]));
	return t.filter((e) => {
		let t = n.get(e.entity_id);
		if (!t || !t.target_when && !e.target_when) return !1;
		let r = t.target_when ?? t.when, i = e.target_when ?? e.when;
		return t.weekday === e.weekday && t.start === e.start && r === i && t.when !== e.when;
	}).map((e) => e.entity_id);
}
//#endregion
//#region src/velair/domain/temperature-units.ts
function P(e) {
	return String(e ?? "").toUpperCase().includes("F");
}
function Tn(e) {
	return P(e) ? 70 : 21;
}
function En(e) {
	return P(e) ? 1 : .3;
}
function Dn(e) {
	return P(e) ? 4 : 2;
}
function On(e) {
	return P(e) ? 14 : 25;
}
function kn(e, t) {
	return P(e) ? t * 9 / 5 : t;
}
function An(e) {
	return P(e) ? [.6, 66.7] : [1, 120];
}
function jn(e) {
	return P(e) ? [-58, 212] : [-50, 100];
}
//#endregion
//#region src/velair/domain/templates.ts
function Mn(e, t) {
	return (e ?? []).map((e) => ({
		key: e.key,
		name: e.name,
		blocks: e.blocks.map((e) => {
			let n = {
				action: e.action ?? "set_temperature",
				start: e.start,
				temperature: Number(e.temperature ?? Tn(t)),
				hvac_mode: e.hvac_mode ?? ""
			};
			return e.fan_mode && (n.fan_mode = e.fan_mode), e.preset_mode && (n.preset_mode = e.preset_mode), e.swing_mode && (n.swing_mode = e.swing_mode), e.swing_horizontal_mode && (n.swing_horizontal_mode = e.swing_horizontal_mode), e.humidity != null && (n.humidity = e.humidity), n;
		})
	}));
}
function Nn(e) {
	return e.name ?? e.key;
}
function Pn(e, t) {
	let n = new Set(t.map((e) => Nn(e)));
	if (!n.has(e)) return e;
	let r = 2;
	for (; n.has(`${e} ${r}`);) r += 1;
	return `${e} ${r}`;
}
function Fn(e = Date.now(), t = Math.random()) {
	return `custom_${e.toString(36)}_${t.toString(36).slice(2, 8)}`;
}
function In(e, t) {
	return `${e}::${t}`;
}
function Ln(e, t, n, r) {
	let i = In(t, n), a = new Set(e);
	return r ? a.add(i) : a.delete(i), a;
}
function Rn(e, t) {
	return [...e].map((e) => {
		let [t, n] = e.split("::");
		return {
			entityId: t,
			weekday: n
		};
	}).filter((e) => !!e.entityId && k.includes(e.weekday) && t.includes(e.entityId));
}
//#endregion
//#region src/velair/domain/overrides.ts
function zn(e, t = Date.now()) {
	if (!e || e.type !== "boost") return !1;
	let n = Number(e.temperature), r = N(e.until);
	return Number.isFinite(n) && !!(r && r > t);
}
function Bn(e, t = Date.now()) {
	if (!e || e.type !== "pause") return !1;
	let n = N(e.until);
	return Object.prototype.hasOwnProperty.call(e, "until") && n === void 0 ? !1 : n === void 0 || n > t;
}
//#endregion
//#region src/velair/domain/timeline.ts
function Vn(e) {
	return e.getHours() * 60 + e.getMinutes();
}
function Hn(e) {
	let t = Vn(e);
	return {
		label: hn(t),
		left: t / 1440 * 100,
		minute: t
	};
}
function Un(e, t, n, r) {
	let i = Math.max(0, t - n);
	if (i <= 1) return 0;
	let a = Math.max(0, Math.min(100, e)), o = Math.max(0, t - r), s = Math.max(0, n - r), c = r + a / 100 * o, l = r + s * .35;
	return Math.max(0, Math.min(i, c - l));
}
function Wn(e) {
	let t = e.map((e, t) => ({
		draft: e,
		index: t,
		startMinute: mn(e.start)
	})).filter((e) => e.startMinute !== void 0).sort((e, t) => e.startMinute - t.startMinute);
	return t.map((e, n) => {
		let r = e.startMinute, i = t[n + 1], a = i?.startMinute, o = typeof a == "number" && a > r ? a : 1440, s = r / 1440 * 100, c = Math.max((o - r) / 1440 * 100, 3.5);
		return {
			draft: e.draft,
			endMinute: o,
			index: e.index,
			left: s,
			nextIndex: i?.index,
			startMinute: r,
			width: Math.min(c, 100 - s)
		};
	});
}
function Gn(e) {
	let t = e.map((e, t) => ({
		block: e,
		index: t,
		startMinute: mn(e.start)
	})).filter((e) => e.startMinute !== void 0).sort((e, t) => e.startMinute - t.startMinute);
	return t.map((e, n) => {
		let r = t[n + 1]?.startMinute, i = typeof r == "number" && r > e.startMinute ? r : 1440, a = e.startMinute / 1440 * 100, o = (i - e.startMinute) / 1440 * 100;
		return {
			block: e.block,
			endMinute: i,
			index: e.index,
			left: a,
			startMinute: e.startMinute,
			width: Math.max(Math.min(o, 100 - a), .5)
		};
	});
}
function Kn(e, t = /* @__PURE__ */ new Date()) {
	if (!zn(e, t.getTime())) return;
	let n = Yn(e.until);
	if (!n) return;
	let r = Yn(e.started_at) ?? t.getTime(), i = new Date(t);
	i.setHours(0, 0, 0, 0);
	let a = new Date(i);
	a.setDate(i.getDate() + 1);
	let o = Math.max(r, i.getTime()), s = Math.min(n, a.getTime());
	if (s <= o || o >= a.getTime() || s <= i.getTime()) return;
	let c = Math.max(0, Math.min(1440, Math.round((o - i.getTime()) / 6e4))), l = Math.max(c + 1, Math.min(1440, Math.round((s - i.getTime()) / 6e4))), u = c / 1440 * 100, d = (l - c) / 1440 * 100, f = Number(e.temperature), p = typeof e.hvac_mode == "string" ? e.hvac_mode : void 0;
	return {
		block: {
			action: qe,
			start: hn(c),
			...Number.isFinite(f) ? { temperature: f } : {},
			...p ? { hvac_mode: p } : {}
		},
		endMinute: l,
		left: u,
		startMinute: c,
		width: Math.max(Math.min(d, 100 - u), .5)
	};
}
function qn(e, t = /* @__PURE__ */ new Date()) {
	if (!Bn(e, t.getTime())) return;
	let n = Yn(e.until), r = new Date(t);
	r.setHours(0, 0, 0, 0);
	let i = new Date(r);
	if (i.setDate(r.getDate() + 1), !n) return {
		endMinute: 1440,
		indefinite: !0,
		left: 0,
		startMinute: 0,
		width: 100
	};
	let a = Yn(e.started_at) ?? t.getTime(), o = Math.max(a, r.getTime()), s = Math.min(n, i.getTime());
	if (s <= o || o >= i.getTime() || s <= r.getTime()) return;
	let c = Math.max(0, Math.min(1440, Math.round((o - r.getTime()) / 6e4))), l = Math.max(c + 1, Math.min(1440, Math.round((s - r.getTime()) / 6e4))), u = c / 1440 * 100, d = (l - c) / 1440 * 100;
	return {
		endMinute: l,
		indefinite: !1,
		left: u,
		startMinute: c,
		width: Math.max(Math.min(d, 100 - u), .5)
	};
}
function Jn(e) {
	return e.map((e, t) => ({
		block: e,
		index: t,
		startMinute: mn(e.start)
	})).sort((e, t) => e.startMinute === void 0 && t.startMinute === void 0 ? e.index - t.index : e.startMinute === void 0 ? 1 : t.startMinute === void 0 ? -1 : e.startMinute - t.startMinute || e.index - t.index).map((e) => e.block);
}
function Yn(e) {
	if (typeof e != "string") return;
	let t = new Date(e).getTime();
	return Number.isNaN(t) ? void 0 : t;
}
function Xn(e, t, n) {
	let r = n > 0 ? (e - t) / n : 0, i = Math.round(Math.min(Math.max(r, 0), 1) * 1440 / 15) * 15;
	return Math.min(i, 1425);
}
function Zn(e) {
	if (e.action === "turn_off") return "off";
	switch (e.hvac_mode) {
		case "heat": return "heat";
		case "cool": return "cool";
		case "heat_cool": return "heat-cool";
		case "dry": return "dry";
		case "fan_only": return "fan";
		case "auto": return "auto";
		case "off": return "off";
		default: return "keep";
	}
}
//#endregion
//#region src/velair/domain/scheduler-state.ts
function Qn(e) {
	return N(e?.paused_until);
}
function $n(e) {
	return N(e?.paused_started_at);
}
function er(e, t, n = Date.now()) {
	if (!e || e >= t) return 100;
	let r = Math.max(1, t - e), i = Math.max(0, t - n);
	return Math.min(100, Math.max(0, i / r * 100));
}
function tr(e, t = Date.now()) {
	return e - t <= 9e4 ? 500 : 1e4;
}
function nr(e, t, n = Date.now()) {
	let r = [Qn(e), ...Object.values(t ?? {}).map((e) => N(e.until))].filter((e) => typeof e == "number" && e > n);
	return r.length ? Math.min(...r) : void 0;
}
//#endregion
//#region src/velair/controllers/scheduler-controls.ts
function F(e) {
	return e;
}
function rr(e) {
	return e._data?.global.mode === "paused" || e._data?.operational_status === "paused";
}
async function ir(e, t, n = {}) {
	let r = e._api();
	if (!(!r || e._controlAction)) {
		e._controlAction = "pause", e._error = void 0, e._saveMessage = void 0;
		try {
			let i = Math.max(1, Math.round(e._pauseDurationMinutes || 1));
			await r.pauseScheduler(t ? void 0 : i), n.showSuccess !== !1 && e._showSuccess(e._t("pauseApplied")), await e._loadSchedule(), e._closeSchedulerMenu();
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unablePause");
		} finally {
			e._controlAction = void 0;
		}
	}
}
async function ar(e, t = {}) {
	let n = e._api();
	if (!(!n || e._controlAction)) {
		e._controlAction = "resume", e._error = void 0, e._saveMessage = void 0;
		try {
			await n.resumeScheduler(), t.showSuccess !== !1 && e._showSuccess(e._t("resumed")), await e._loadSchedule(), e._closeSchedulerMenu();
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableResume");
		} finally {
			e._controlAction = void 0;
		}
	}
}
function or(e) {
	let t = e.renderRoot.querySelector(".scheduler-menu");
	t instanceof HTMLDetailsElement && (t.open = !1), e._schedulerMenuOpen = !1;
}
function sr(e, t) {
	let n = t.currentTarget.closest(".scheduler-menu");
	e._schedulerMenuOpen = n instanceof HTMLDetailsElement ? !n.open : !e._schedulerMenuOpen;
}
function cr(e) {
	e._nextEventsOpen = !e._nextEventsOpen;
}
function lr(e) {
	return Qn(e._data?.global);
}
function ur(e, t) {
	return er($n(e._data?.global), t);
}
function dr(e) {
	let t = fr(e);
	if (!t || t <= Date.now()) {
		e._stopPauseTick();
		return;
	}
	let n = tr(t);
	(!e._pauseTick || e._pauseTickDelay !== n) && (e._stopPauseTick(), e._pauseTickDelay = n, e._pauseTick = window.setInterval(() => {
		let t = e._nextCountdownExpirationMs();
		!t || t <= Date.now() ? e._stopPauseTick() : e._pauseTickDelay !== tr(t) && e._syncPauseTick(), e.requestUpdate();
	}, n));
}
function fr(e) {
	return nr(e._data?.global, e._data?.active_overrides);
}
function pr(e) {
	e._pauseTick && (window.clearInterval(e._pauseTick), e._pauseTick = void 0, e._pauseTickDelay = void 0);
}
//#endregion
//#region src/velair/controllers/notice-actions.ts
function mr(e) {
	return e;
}
function hr(e, t) {
	t === "error" && (e._error = void 0), t === "success" && (e._saveMessage = void 0, vr(e));
}
function gr(e, t) {
	e._saveMessage = t, e._successNoticeStartedAt = Date.now(), vr(e, !1), e._successNoticeTimeout = window.setTimeout(() => {
		e._saveMessage = void 0, vr(e);
	}, Xe), e._successNoticeTick = window.setInterval(() => e.requestUpdate(), 1e3);
}
function _r(e) {
	if (!e._successNoticeStartedAt) return 100;
	let t = Date.now() - e._successNoticeStartedAt;
	return Math.max(0, Math.min(100, (Xe - t) / Xe * 100));
}
function vr(e, t = !0) {
	e._successNoticeTimeout &&= (window.clearTimeout(e._successNoticeTimeout), void 0), e._successNoticeTick &&= (window.clearInterval(e._successNoticeTick), void 0), t && (e._successNoticeStartedAt = void 0);
}
//#endregion
//#region src/velair/domain/draft-blocks.ts
function yr(e, t) {
	return e.map((e) => {
		let n = {
			action: e.action ?? "set_temperature",
			start: e.start,
			temperature: Number(e.temperature ?? Tn(t)),
			hvac_mode: e.hvac_mode ?? ""
		};
		return e.fan_mode && (n.fan_mode = e.fan_mode), e.preset_mode && (n.preset_mode = e.preset_mode), e.swing_mode && (n.swing_mode = e.swing_mode), e.swing_horizontal_mode && (n.swing_horizontal_mode = e.swing_horizontal_mode), e.humidity != null && (n.humidity = e.humidity), n;
	});
}
function br(e, t, n) {
	let r = e[e.length - 1];
	return [...e, {
		action: qe,
		start: t,
		temperature: Number(r?.temperature || Tn(n)),
		hvac_mode: ""
	}];
}
function xr(e, t) {
	return e.filter((e, n) => n !== t);
}
function Sr(e, t, n, r) {
	return e[t] ? e.map((e, i) => i === t ? n === "hvac_mode" ? {
		...e,
		action: r === "off" ? Je : qe,
		hvac_mode: r === "off" ? "" : r
	} : {
		...e,
		[n]: r
	} : e) : e;
}
function Cr(e, t) {
	if ((e.action || "set_temperature") === "turn_off") return;
	let n = String(e.temperature ?? "").trim();
	if (!n || !/^\d+(\.\d+)?$/.test(n)) return t.rangeError;
	let r = Number(n);
	if (!Number.isFinite(r) || r < t.minTemperature || r > t.maxTemperature) return t.rangeError;
	if (t.temperatureStep !== void 0 && Math.abs(r / t.temperatureStep - Math.round(r / t.temperatureStep)) > 1e-4) return t.stepError;
}
function wr(e, t) {
	let n = /* @__PURE__ */ new Set(), r = [];
	for (let i of e) {
		let e = String(i.start || "").trim();
		if (!/^\d{2}:\d{2}$/.test(e)) return {
			ok: !1,
			error: t.invalidStartError(e || "empty")
		};
		let [a, o] = e.split(":").map((e) => Number(e));
		if (a < 0 || a > 23 || o < 0 || o > 59) return {
			ok: !1,
			error: t.invalidStartError(e)
		};
		if (n.has(e)) return {
			ok: !1,
			error: t.duplicateStartError(e)
		};
		if ((i.action || "set_temperature") === "turn_off") {
			r.push({
				start: e,
				action: Je
			}), n.add(e);
			continue;
		}
		let s = t.temperatureError(i);
		if (s) return {
			ok: !1,
			error: t.invalidTemperatureError(e, s)
		};
		let c = {
			action: qe,
			start: e,
			temperature: Number(i.temperature)
		};
		if (i.hvac_mode && (c.hvac_mode = i.hvac_mode), i.fan_mode && (c.fan_mode = i.fan_mode), i.preset_mode && (c.preset_mode = i.preset_mode), i.swing_mode && (c.swing_mode = i.swing_mode), i.swing_horizontal_mode && (c.swing_horizontal_mode = i.swing_horizontal_mode), String(i.humidity ?? "").trim()) {
			let e = Number(i.humidity);
			Number.isFinite(e) && (c.humidity = e);
		}
		r.push(c), n.add(e);
	}
	return {
		ok: !0,
		blocks: r.sort((e, t) => e.start.localeCompare(t.start))
	};
}
function Tr(e, t, n) {
	return e.map((e) => (e.action || "set_temperature") === "turn_off" || e.temperature == null ? { ...e } : {
		...e,
		temperature: Math.min(n, Math.max(t, Number(e.temperature)))
	});
}
function Er(e, t) {
	let n = new Set(t);
	return e.find((e) => (e.action || "set_temperature") !== "turn_off" && !!e.hvac_mode && !n.has(e.hvac_mode ?? ""));
}
function Dr(e, t) {
	return e.map((e) => {
		if ((e.action || "set_temperature") === "turn_off") return {
			start: e.start,
			action: Je
		};
		let n = { ...e };
		return t.fanModes.includes(n.fan_mode ?? "") || delete n.fan_mode, t.presetModes.includes(n.preset_mode ?? "") || delete n.preset_mode, t.swingModes.includes(n.swing_mode ?? "") || delete n.swing_mode, t.swingHorizontalModes.includes(n.swing_horizontal_mode ?? "") || delete n.swing_horizontal_mode, (n.humidity == null || !t.humidityLimits || n.humidity < t.humidityLimits[0] || n.humidity > t.humidityLimits[1]) && delete n.humidity, n;
	});
}
//#endregion
//#region src/velair/controllers/draft-actions.ts
function I(e) {
	return e;
}
function Or(e, t = "schedule") {
	let n = e._blocksForSource(t), r = e._temperatureUnit(t === "schedule" ? e._selectedEntity : void 0);
	e._setBlocksForSource(t, br(n, gn(n.at(-1)?.start), r)), e._markBlocksDirty(t), e._saveMessage = void 0;
}
function kr(e, t, n = "schedule") {
	e._setBlocksForSource(n, xr(e._blocksForSource(n), t)), e._markBlocksDirty(n), e._saveMessage = void 0;
}
function Ar(e, t, n, r, i = "schedule") {
	let a = e._blocksForSource(i);
	a[t] && (e._setBlocksForSource(i, Sr(a, t, n, r)), e._markBlocksDirty(i), e._saveMessage = void 0);
}
function jr(e) {
	e._dirty = !0, e._dirtyEntityId = e._selectedEntity;
}
function Mr(e, t, n, r = {}, i = "schedule") {
	let a = e._blocksForSource(i);
	a[t] && (e._setBlocksForSource(i, a.map((e, r) => r === t ? {
		...e,
		start: n
	} : e)), r.sort && e._setBlocksForSource(i, Jn(e._blocksForSource(i))), e._markBlocksDirty(i), e._saveMessage = void 0);
}
function Nr(e, t, n) {
	!k.includes(t) || t === e._selectedWeekday || (e._copyTargets = Lt(e._copyTargets, t, n), e._saveMessage = void 0);
}
function Pr(e, t, n) {
	!(e._data?.configured_entities ?? []).includes(t) || t === e._selectedEntity || (e._zoneTargets = Lt(e._zoneTargets, t, n), e._saveMessage = void 0);
}
//#endregion
//#region src/velair/controllers/draft-validation.ts
function Fr(e) {
	return e;
}
function Ir(e, t = "schedule") {
	return e._blocksForSource(t).some((n) => !!Lr(e, n, t));
}
function Lr(e, t, n = "schedule") {
	let [r, i] = e._temperatureLimits(n), a = e._temperatureStep(n);
	return Cr(t, {
		maxTemperature: i,
		minTemperature: r,
		rangeError: e._t("invalidTemperatureRange", {
			min: e._formatTemperatureLimit(r),
			max: e._formatTemperatureLimit(i)
		}),
		stepError: e._t("invalidTemperatureStep", { step: a === void 0 ? "" : e._formatTemperatureLimit(a) }),
		temperatureStep: a
	});
}
//#endregion
//#region src/velair/domain/portable.ts
function Rr(e) {
	let t = Number(e?.model_version), n = e?.temperature_unit, r = n === void 0 || n === "°C" || t >= 3 && n === "°F";
	if (!e || e.format !== "velair_portable_data" || !Number.isInteger(e.model_version) || t < 1 || t > 3 || !r || !e.sections || typeof e.sections != "object") return {
		ok: !1,
		errorKey: "invalidImportFile"
	};
	let i = zr(e);
	return i.length ? {
		ok: !0,
		sections: i
	} : {
		ok: !1,
		errorKey: "noImportSections"
	};
}
function zr(e) {
	let t = e?.sections;
	return !t || typeof t != "object" ? [] : $e.filter((e) => Object.prototype.hasOwnProperty.call(t, e));
}
function Br(e, t) {
	let n = [];
	return e.has("zones") && n.push({
		section: "zones",
		value: t.zones
	}), e.has("templates") && n.push({
		section: "templates",
		value: t.templates
	}), e.has("settings") && n.push({
		section: "settings",
		value: "included"
	}), e.has("preconditioning_learning") && n.push({
		section: "preconditioning_learning",
		value: t.preconditioningLearning
	}), n;
}
function Vr(e) {
	let t = e?.sections;
	if (!t) return [];
	let n = [];
	if (Object.prototype.hasOwnProperty.call(t, "zones")) {
		let e = t.zones;
		n.push({
			section: "zones",
			value: e && typeof e == "object" && !Array.isArray(e) ? Object.keys(e).length : 0
		});
	}
	if (Object.prototype.hasOwnProperty.call(t, "templates")) {
		let e = t.templates;
		n.push({
			section: "templates",
			value: Array.isArray(e) ? e.length : 0
		});
	}
	if (Object.prototype.hasOwnProperty.call(t, "settings") && n.push({
		section: "settings",
		value: "included"
	}), Object.prototype.hasOwnProperty.call(t, "preconditioning_learning")) {
		let e = t.preconditioning_learning;
		n.push({
			section: "preconditioning_learning",
			value: e && typeof e == "object" && !Array.isArray(e) ? Object.keys(e).length : 0
		});
	}
	return n;
}
function Hr(e, t) {
	let n = e?.sections?.preconditioning_learning;
	if (!n || typeof n != "object" || Array.isArray(n)) return [];
	let r = new Set(t);
	return Object.keys(n).filter((e) => !r.has(e));
}
//#endregion
//#region src/velair/controllers/portability-actions.ts
function L(e) {
	return e;
}
function Ur(e, t, n, r) {
	let i = new Set(t === "export" ? e._exportSections : e._importSections);
	r ? i.add(n) : i.delete(n), t === "export" ? e._exportSections = i : e._importSections = i;
}
async function Wr(e, t) {
	let n = t.currentTarget, r = n.files?.[0];
	if (e._importPayload = void 0, e._importFileName = "", e._importSections = /* @__PURE__ */ new Set(), e._error = void 0, e._saveMessage = void 0, r) try {
		let t = JSON.parse(await r.text()), n = Rr(t);
		if (!n.ok) throw Error(e._t(n.errorKey));
		e._importPayload = t, e._importFileName = r.name, e._importSections = new Set(n.sections);
	} catch (t) {
		e._error = t instanceof Error ? t.message : e._t("invalidImportFile"), n.value = "";
	}
}
async function Gr(e) {
	let t = e._api();
	if (!(!t || !e._exportSections.size)) {
		e._portabilityAction = "export", e._error = void 0, e._saveMessage = void 0;
		try {
			let n = await t.exportData([...e._exportSections]);
			e._downloadPortablePayload(n), e._saveMessage = e._t("portableExported");
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableExport");
		} finally {
			e._portabilityAction = void 0;
		}
	}
}
async function Kr(e) {
	let t = e._api();
	if (!(!t || !e._importPayload || !e._importSections.size)) {
		e._portabilityAction = "import", e._error = void 0, e._saveMessage = void 0;
		try {
			let n = await t.importData(e._importPayload, [...e._importSections]);
			e._applyScheduleData(n, { forceDraft: !0 }), e._saveMessage = e._t("portableImported");
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("invalidImportFile");
		} finally {
			e._portabilityAction = void 0;
		}
	}
}
async function qr(e) {
	let t = e._api();
	if (!(!t || e._maintenanceAction) && window.confirm(e._t("confirmReset"))) {
		e._maintenanceAction = "reset", e._error = void 0, e._saveMessage = void 0;
		try {
			let n = await t.resetData();
			e._selectedTemplateKey = "", e._templateApplyOpen = !1, e._templateApplyTargets = /* @__PURE__ */ new Set(), e._applyScheduleData(n, { forceDraft: !0 }), e._showSuccess(e._t("resetDone"));
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableSaveSettings");
		} finally {
			e._maintenanceAction = void 0;
		}
	}
}
function Jr(e) {
	return zr(e._importPayload);
}
function Yr(e) {
	return Br(new Set($e), {
		zones: e._data?.configured_entities.length ?? 0,
		templates: e._scheduleTemplates().length,
		preconditioningLearning: Object.values(e._data?.preconditioning_learning ?? {}).filter((e) => e.total_samples > 0).length
	}).map((t) => e._portableSummaryItem(t));
}
function Xr(e) {
	return Vr(e._importPayload).map((t) => e._portableSummaryItem(t));
}
function Zr(e, t) {
	let n = e._portableSectionLabel(t.section);
	return {
		label: n,
		section: t.section,
		title: n,
		value: t.value === "included" ? e._t("portabilityIncluded") : t.value
	};
}
function Qr(e, t) {
	switch (t) {
		case "preconditioning_learning": return e._t("portabilityPreconditioningLearningSection");
		case "templates": return e._t("portabilityTemplatesSection");
		case "settings": return e._t("portabilitySettingsSection");
		default: return e._t("portabilityZonesSection");
	}
}
function $r(e) {
	let t = (/* @__PURE__ */ new Date()).toISOString().slice(0, 10), n = new Blob([JSON.stringify(e, null, 2)], { type: "application/json" }), r = URL.createObjectURL(n), i = document.createElement("a");
	i.href = r, i.download = `velair-export-${t}.json`, i.style.display = "none", document.body.append(i), i.click(), i.remove(), URL.revokeObjectURL(r);
}
//#endregion
//#region src/velair/controllers/settings-actions.ts
function R(e) {
	return e;
}
async function ei(e, t) {
	let n = k.includes(t) ? t : "monday";
	e._selectedWeekday = n, e._copyTargets = /* @__PURE__ */ new Set(), e._zoneTargets = /* @__PURE__ */ new Set(), await e._saveSettings({ first_weekday: n }), e._resetDraftBlocks();
}
async function ti(e, t) {
	let n = e._api(), r = {
		...e._config,
		first_weekday: t.first_weekday ?? e._config.first_weekday,
		zone_order: t.zone_order ?? e._config.zone_order
	};
	if (delete r.selected_entity, e._config = r, !(!n || e._hasExternalConfig)) {
		e._settingsSaving = !0, e._error = void 0, e._saveMessage = void 0;
		try {
			let r = await n.updateSettings(t);
			e._applyScheduleData(r);
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableReset");
		} finally {
			e._settingsSaving = !1;
		}
	}
}
async function ni(e, t, n) {
	let r = e._api();
	if (r) {
		e._settingsSaving = !0, e._error = void 0, e._saveMessage = void 0;
		try {
			let i = await r.updateZonePreconditioning(t, n);
			e._applyScheduleData(i);
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableSaveSettings");
		} finally {
			e._settingsSaving = !1;
		}
	}
}
async function ri(e, t, n) {
	let r = e._api();
	if (r) {
		e._settingsSaving = !0, e._error = void 0, e._saveMessage = void 0;
		try {
			let i = await r.updateZoneComfort(t, n);
			e._applyScheduleData(i);
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableSaveSettings");
		} finally {
			e._settingsSaving = !1;
		}
	}
}
async function ii(e, t, n, r) {
	let i = e._api();
	if (i && window.confirm(e._t("confirmResetPreconditioningLearning", { direction: r }))) {
		e._settingsSaving = !0, e._error = void 0, e._saveMessage = void 0;
		try {
			let a = await i.resetZonePreconditioningLearning(t, n);
			e._applyScheduleData(a), e._showSuccess(e._t("preconditioningLearningResetDone", { direction: r }));
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableSaveSettings");
		} finally {
			e._settingsSaving = !1;
		}
	}
}
async function ai(e, t) {
	let n = e._api();
	if (n && window.confirm(e._t("confirmResetPreconditioningSettings"))) {
		e._settingsSaving = !0, e._error = void 0, e._saveMessage = void 0;
		try {
			let r = await n.resetZonePreconditioningSettings(t);
			e._applyScheduleData(r), e._showSuccess(e._t("preconditioningSettingsResetDone"));
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableSaveSettings");
		} finally {
			e._settingsSaving = !1;
		}
	}
}
function oi(e, t, n) {
	let r = e._orderedZoneIds(e._data?.configured_entities ?? []), i = r.indexOf(t), a = i + n;
	if (i < 0 || a < 0 || a >= r.length) return;
	let o = [...r];
	[o[i], o[a]] = [o[a], o[i]], e._updateSettingsZoneOrder(o);
}
function si(e, t, n) {
	e._draggedSettingsEntity = t, n.dataTransfer?.setData("text/plain", t), n.dataTransfer && (n.dataTransfer.effectAllowed = "move");
}
function ci(e) {
	e.preventDefault(), e.dataTransfer && (e.dataTransfer.dropEffect = "move");
}
function li(e, t, n) {
	n.preventDefault();
	let r = n.dataTransfer?.getData("text/plain") || e._draggedSettingsEntity;
	if (e._draggedSettingsEntity = void 0, !r || r === t) return;
	let i = e._orderedZoneIds(e._data?.configured_entities ?? []).filter((e) => e !== r), a = i.indexOf(t);
	a < 0 || (i.splice(a, 0, r), e._updateSettingsZoneOrder(i));
}
function ui(e) {
	e._draggedSettingsEntity = void 0;
}
function di(e, t) {
	let n = new Set(e._data?.configured_entities ?? []), r = t.filter((e) => n.has(e));
	e._saveSettings({ zone_order: r });
}
//#endregion
//#region src/velair/controllers/timeline-interactions.ts
function z(e) {
	return e;
}
function fi(e, t, n, r) {
	e._draggedTimelineIndex = t, r.dataTransfer?.setData("text/plain", JSON.stringify({
		index: t,
		source: n
	})), r.dataTransfer && (r.dataTransfer.effectAllowed = "move");
}
function pi(e) {
	e.preventDefault(), e.dataTransfer && (e.dataTransfer.dropEffect = "move");
}
function mi(e, t, n = "schedule") {
	t.preventDefault();
	let { index: r, source: i } = hi(e, t, n);
	if (e._draggedTimelineIndex = void 0, !Number.isInteger(r) || !e._blocksForSource(i)[r]) return;
	let a = t.currentTarget, o = Ci(e, t.clientX, a);
	e._setDraftBlockStart(r, o, { sort: !0 }, i);
}
function hi(e, t, n) {
	let r = t.dataTransfer?.getData("text/plain");
	if (r) try {
		let e = JSON.parse(r);
		if (typeof e.index == "number" && (e.source === "schedule" || e.source === "template")) return {
			index: e.index,
			source: e.source
		};
	} catch {
		let e = Number(r);
		if (Number.isInteger(e)) return {
			index: e,
			source: n
		};
	}
	return {
		index: Number(e._draggedTimelineIndex),
		source: n
	};
}
function gi(e) {
	e._draggedTimelineIndex = void 0;
}
function _i(e, t, n, r, i) {
	i.preventDefault(), i.stopPropagation();
	let a = i.currentTarget.closest(".timeline-track");
	a instanceof HTMLElement && (e._timelineResize = {
		edge: n,
		index: t,
		source: r,
		track: a
	}, e.classList.add("timeline-resizing"), Ti(e, "ew-resize"), window.addEventListener("pointermove", e._handleTimelineResizeMove), window.addEventListener("pointerup", e._handleTimelineResizeEnd, { once: !0 }), e._resizeTimelineBlock(t, n, wi(i.clientX, a), r));
}
function vi(e, t) {
	if (!e._timelineResize) return;
	t.preventDefault();
	let { edge: n, index: r, source: i, track: a } = e._timelineResize;
	e._resizeTimelineBlock(r, n, wi(t.clientX, a), i);
}
function yi(e) {
	window.removeEventListener("pointermove", e._handleTimelineResizeMove);
	let t = e._timelineResize?.source ?? "schedule";
	e.classList.remove("timeline-resizing"), e._timelineResize = void 0, Ei(e), e._sortDraftBlocksByStart(t);
}
function bi(e, t, n, r, i = "schedule") {
	let a = Si(e, i), o = a.findIndex((e) => e.index === t), s = a[o];
	if (!s) return;
	if (n === "start") {
		let n = a[o - 1]?.startMinute, c = typeof n == "number" ? n + 15 : 0, l = s.endMinute - 15;
		e._setDraftBlockStart(t, hn(_n(r, c, l)), {}, i);
		return;
	}
	let c = a[o + 1];
	if (!c) return;
	let l = a[o + 2]?.startMinute, u = s.startMinute + 15, d = typeof l == "number" ? l - 15 : 1425;
	e._setDraftBlockStart(c.index, hn(_n(r, u, d)), {}, i);
}
function xi(e, t = "schedule") {
	e._setBlocksForSource(t, Jn(e._blocksForSource(t)));
}
function Si(e, t = "schedule") {
	return Wn(e._blocksForSource(t));
}
function Ci(e, t, n) {
	return hn(wi(t, n));
}
function wi(e, t) {
	let n = t.getBoundingClientRect();
	return Xn(e, n.left, n.width);
}
function Ti(e, t) {
	document.body && (e._previousBodyCursor === void 0 && (e._previousBodyCursor = document.body.style.cursor), e._previousDocumentCursor === void 0 && (e._previousDocumentCursor = document.documentElement.style.cursor), document.body.style.cursor = t, document.documentElement.style.cursor = t);
}
function Ei(e) {
	!document.body || e._previousBodyCursor === void 0 || (document.body.style.cursor = e._previousBodyCursor, document.documentElement.style.cursor = e._previousDocumentCursor ?? "", e._previousBodyCursor = void 0, e._previousDocumentCursor = void 0);
}
//#endregion
//#region src/velair/controllers/schedule-actions.ts
function B(e) {
	return e;
}
async function Di(e) {
	let t = e._api();
	if (!t || !e._selectedEntity || e._saving) return;
	let n = e._normalizeDraftBlocks();
	if (!n.ok) {
		e._error = n.error;
		return;
	}
	let r = e._unsupportedModeError(n.blocks, e._selectedEntity);
	if (r) {
		e._error = r;
		return;
	}
	e._saving = !0, e._error = void 0, e._saveMessage = void 0;
	try {
		let r = await t.setDailySchedule(e._selectedEntity, e._selectedWeekday, n.blocks);
		e._dirty = !1, e._dirtyEntityId = void 0, e._applyScheduleData(r, { forceDraft: !0 }), e._showSuccess(e._t("saved"));
	} catch (t) {
		e._error = t instanceof Error ? t.message : e._t("unableSave");
	} finally {
		e._saving = !1;
	}
}
async function Oi(e) {
	let t = e._api();
	if (!t || !e._selectedEntity || e._copying || e._copyTargets.size === 0) return;
	let n = e._normalizeDraftBlocks();
	if (!n.ok) {
		e._error = n.error;
		return;
	}
	let r = e._unsupportedModeError(n.blocks, e._selectedEntity);
	if (r) {
		e._error = r;
		return;
	}
	let i = [...e._copyTargets];
	e._copying = !0, e._error = void 0, e._saveMessage = void 0;
	try {
		e._dirty && await t.setDailySchedule(e._selectedEntity, e._selectedWeekday, n.blocks);
		let r = await t.copyDaySchedule(e._selectedEntity, e._selectedWeekday, i);
		e._dirty = !1, e._dirtyEntityId = void 0, e._copyTargets = /* @__PURE__ */ new Set(), e._applyScheduleData(r, { forceDraft: !0 }), e._showSuccess(e._t("appliedDays", {
			count: i.length,
			suffix: i.length === 1 ? "" : "s"
		}));
	} catch (t) {
		e._error = t instanceof Error ? t.message : e._t("unableCopy");
	} finally {
		e._copying = !1;
	}
}
async function ki(e) {
	let t = e._api();
	if (!t || !e._selectedEntity || e._applyingZones || e._zoneTargets.size === 0) return;
	let n = e._normalizeDraftBlocks();
	if (!n.ok) {
		e._error = n.error;
		return;
	}
	let r = [...e._zoneTargets];
	for (let t of r) {
		let r = e._unsupportedModeError(n.blocks, t);
		if (r) {
			e._error = r;
			return;
		}
	}
	e._applyingZones = !0, e._error = void 0, e._saveMessage = void 0;
	try {
		let i;
		e._dirty && (i = await t.setDailySchedule(e._selectedEntity, e._selectedWeekday, n.blocks));
		for (let a of r) i = await t.setDailySchedule(a, e._selectedWeekday, e._clampBlocksForEntity(n.blocks, a));
		e._dirty = !1, e._dirtyEntityId = void 0, e._zoneTargets = /* @__PURE__ */ new Set(), i && e._applyScheduleData(i, { forceDraft: !0 }), e._showSuccess(e._t("appliedThermostats", {
			count: r.length,
			suffix: r.length === 1 ? "" : "s"
		}));
	} catch (t) {
		e._error = t instanceof Error ? t.message : e._t("unableApplyThermostats");
	} finally {
		e._applyingZones = !1;
	}
}
function Ai(e, t = "schedule") {
	return wr(e._blocksForSource(t), {
		duplicateStartError: (t) => e._t("duplicateStart", { start: t }),
		invalidStartError: (t) => e._t("invalidStart", { start: t }),
		invalidTemperatureError: (t, n) => `${e._t("invalidTemperature", { start: t })}: ${n}`,
		temperatureError: (n) => e._temperatureError(n, t)
	});
}
function ji(e, t, n) {
	let [r, i] = e._entityTemperatureLimits(n);
	return Dr(Tr(t, r, i), {
		fanModes: e._entityFanModeOptions(n),
		humidityLimits: e._entityHumidityLimits(n),
		presetModes: e._entityPresetModeOptions(n),
		swingHorizontalModes: e._entitySwingHorizontalModeOptions(n),
		swingModes: e._entitySwingModeOptions(n)
	});
}
function Mi(e, t, n) {
	let r = Er(t, e._climateSupportedModes(n));
	if (r?.hvac_mode) return e._t("unsupportedModeForClimate", {
		entity: e._friendlyEntityName(n),
		mode: e._modeLabel(r.hvac_mode),
		start: r.start
	});
}
//#endregion
//#region src/velair/controllers/schedule-state.ts
function V(e) {
	return e;
}
async function Ni(e) {
	let t = e._api();
	if (!(!t || e._loading)) {
		e._loading = !0, e._error = void 0;
		try {
			let n = await t.getSchedule();
			e._applyScheduleData(n);
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableLoad");
		} finally {
			e._loading = !1;
		}
	}
}
async function Pi(e) {
	let t = e._api();
	if (!(!t || e._unsubscribeUpdates || e._subscribing)) {
		e._subscribing = !0;
		try {
			e._unsubscribeUpdates = await t.subscribeUpdates((t) => {
				if (!t.loaded || !t.schedule) {
					e._loadSchedule();
					return;
				}
				e._applyScheduleData(t.schedule);
			});
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableSubscribe");
		} finally {
			e._subscribing = !1;
		}
	}
}
function Fi(e, t, n = {}) {
	let r = !e._data;
	e._data = t, e._hasExternalConfig || (e._config = {
		first_weekday: t.settings.first_weekday,
		zone_order: t.settings.zone_order
	}), r && (e._selectedWeekday = t.settings.first_weekday);
	let i = e._orderedZoneIds(t.configured_entities), a = e._visibleZoneIds(t.configured_entities);
	(!e._selectedEntity || !t.configured_entities.includes(e._selectedEntity)) && (e._selectedEntity = i[0]), a.length && e._selectedEntity && !a.includes(e._selectedEntity) && (e._selectedEntity = a[0]), e._selectedTemplateKey && !e._scheduleTemplates().some((t) => t.key === e._selectedTemplateKey) && (e._selectedTemplateKey = "");
	let o = e._scheduleTemplates().find((t) => t.key === e._selectedTemplateKey);
	o ? (n.forceDraft || !e._templateDirty || e._templateDraftKey !== o.key) && e._resetTemplateDraft(o) : e._resetTemplateDraft(), e._syncPauseTick(), (n.forceDraft || !e._dirty) && e._resetDraftBlocks();
}
function Ii(e) {
	e._draftBlocks = yr((e._selectedEntity ? e._data?.zones[e._selectedEntity] : void 0)?.schedule?.[e._selectedWeekday] ?? [], e._temperatureUnit(e._selectedEntity)), e._dirty = !1, e._dirtyEntityId = void 0;
}
function Li(e, t) {
	e._selectedEntity = t, e._saveMessage = void 0, e._copyTargets = /* @__PURE__ */ new Set(), e._zoneTargets = /* @__PURE__ */ new Set(), e._resetDraftBlocks();
}
function Ri(e, t) {
	k.includes(t) && (e._selectedWeekday = t, e._saveMessage = void 0, e._copyTargets = /* @__PURE__ */ new Set(), e._zoneTargets = /* @__PURE__ */ new Set(), e._resetDraftBlocks());
}
function zi(e, t) {
	return t === "template" ? e._templateDraftBlocks : e._draftBlocks;
}
function Bi(e, t, n) {
	if (t === "template") {
		e._templateDraftBlocks = n;
		return;
	}
	e._draftBlocks = n;
}
function Vi(e, t) {
	if (t === "template") {
		e._templateDirty = !0;
		return;
	}
	e._markDirty();
}
//#endregion
//#region src/velair/domain/entity-diagnostics.ts
function Hi(e, t, n) {
	let r = [], i = "ok";
	if (!t) return {
		messageKeys: ["entityDiagnosticMissing"],
		status: "error"
	};
	e.startsWith("climate.") || (r.push("entityDiagnosticNotClimate"), i = "error"), n.length || (r.push("entityDiagnosticNoModes"), i = i === "error" ? "error" : "warning");
	let a = t.attributes ?? {};
	return (typeof a.min_temp != "number" || typeof a.max_temp != "number") && (r.push("entityDiagnosticNoRange"), i = i === "error" ? "error" : "warning"), {
		messageKeys: r,
		status: i
	};
}
//#endregion
//#region src/velair/domain/formatters.ts
function Ui(e) {
	return e === "es" ? "es-ES" : "en";
}
function Wi(e) {
	let t = String(e ?? "").toLowerCase(), n = t === "12" ? !0 : t === "24" ? !1 : void 0;
	return {
		hour: "numeric",
		minute: "2-digit",
		...n === void 0 ? {} : { hour12: n }
	};
}
function Gi(e, t, n) {
	let r = new Date(e);
	return Number.isNaN(r.getTime()) ? e : r.toLocaleString(t, {
		...Wi(n),
		weekday: "short"
	});
}
function Ki(e, t, n) {
	let r = /^(\d{1,2}):(\d{2})$/.exec(e);
	if (!r) return e;
	let i = Number(r[1]), a = Number(r[2]);
	return i < 0 || i > 23 || a < 0 || a > 59 ? e : new Date(2e3, 0, 1, i, a).toLocaleTimeString(t, Wi(n));
}
function qi(e) {
	let t = Math.max(0, Math.ceil(e / 1e3));
	if (t < 60) return `${t} s`;
	let n = Math.floor(t / 60);
	if (n < 60) return `${n} min`;
	let r = Math.floor(n / 60), i = n % 60;
	return i ? `${r} h ${i} min` : `${r} h`;
}
function Ji(e, t) {
	return `${e.toFixed(e % 1 == 0 ? 0 : 1)} ${t}`;
}
function Yi(e, t) {
	return e ?? t ?? "°C";
}
function Xi(e, t, n) {
	return e.action === "turn_off" ? t.off : e.temperature == null ? t.setTemperature : n(Number(e.temperature), e.entity_id);
}
function Zi(e, t, n) {
	return e.hvac_mode ? n(e.hvac_mode) : e.action === "turn_off" ? n("off") : t.keepMode;
}
//#endregion
//#region src/velair/controllers/climate-display.ts
function H(e) {
	return e;
}
function Qi(e, t = "schedule", n = e._selectedEntity) {
	return t === "template" ? e._templateTemperatureLimits() : e._entityTemperatureLimits(n);
}
function $i(e, t) {
	return ht(t ? e.hass?.states?.[t] : void 0, e._temperatureUnit(t));
}
function ea(e) {
	return Pt((e._data?.configured_entities ?? []).map((t) => e._entityTemperatureLimits(t)));
}
function ta(e, t = "schedule", n = e._selectedEntity) {
	return t === "template" ? Ft((e._data?.configured_entities ?? []).map((t) => e._entityTemperatureStep(t))) : e._entityTemperatureStep(n);
}
function na(e, t) {
	return gt(t ? e.hass?.states?.[t] : void 0);
}
function ra(e, t) {
	return !!e.hass?.states?.[t];
}
function ia(e, t) {
	return e.hass?.states?.[t]?.attributes?.friendly_name ?? t;
}
function aa(e, t) {
	return vt(e.hass?.states?.[t]);
}
function oa(e, t = "schedule") {
	return t === "template" ? e._uniqueModes((e._data?.configured_entities ?? []).flatMap((t) => e._climateSupportedModes(t))) : e._uniqueModes(e._selectedEntity ? e._climateSupportedModes(e._selectedEntity) : []);
}
function sa(e, t = "schedule") {
	return Oa(e, t, yt);
}
function ca(e, t) {
	return va(yt(e.hass?.states?.[t]));
}
function la(e, t = "schedule") {
	return Oa(e, t, bt);
}
function ua(e, t) {
	return va(bt(e.hass?.states?.[t]));
}
function da(e, t = "schedule") {
	return Oa(e, t, xt);
}
function fa(e, t) {
	return va(xt(e.hass?.states?.[t]));
}
function pa(e, t = "schedule") {
	return Oa(e, t, St);
}
function ma(e, t) {
	return va(St(e.hass?.states?.[t]));
}
function ha(e, t = "schedule") {
	if (t === "template") {
		let t = (e._data?.configured_entities ?? []).map((t) => Ct(e.hass?.states?.[t])).filter((e) => !!e);
		return t.length ? [Math.min(...t.map((e) => e[0])), Math.max(...t.map((e) => e[1]))] : void 0;
	}
	return e._selectedEntity ? Ct(e.hass?.states?.[e._selectedEntity]) : void 0;
}
function ga(e, t) {
	return Ct(e.hass?.states?.[t]);
}
function _a(e) {
	return wt(e);
}
function va(e) {
	return [...new Set(e)].sort((e, t) => e.localeCompare(t));
}
function ya(e, t) {
	let n = Hi(t, e.hass?.states?.[t], e._climateSupportedModes(t)), r = n.messageKeys.map((t) => e._t(t));
	return {
		messages: r,
		status: n.status,
		tooltip: r.length ? r.join(" · ") : e._t("entityDiagnosticOk")
	};
}
function ba(e, t) {
	return Tt(e.hass?.states?.[t]).map((t) => ({
		icon: t.icon,
		label: e._t(t.labelKey)
	}));
}
function xa(e, t) {
	return Gi(t, e._dateLocale(), e.hass?.locale?.time_format);
}
function Sa(e, t) {
	return Ki(t, e._dateLocale(), e.hass?.locale?.time_format);
}
function Ca(e) {
	return Ui(e._language());
}
function wa(e, t, n) {
	return Ji(t, e._temperatureUnit(n));
}
function Ta(e, t) {
	return Xi(t, {
		off: e._t("off"),
		setTemperature: e._t("setTemperature")
	}, (t, n) => e._formatTemperature(t, n));
}
function Ea(e, t) {
	return Zi(t, { keepMode: e._t("keepMode") }, (t) => e._modeLabel(t));
}
function Da(e, t) {
	return e._data?.temperature_unit ?? Yi(void 0, e.hass?.config?.unit_system?.temperature);
}
function Oa(e, t, n) {
	return va(t === "template" ? (e._data?.configured_entities ?? []).flatMap((t) => n(e.hass?.states?.[t])) : e._selectedEntity ? n(e.hass?.states?.[e._selectedEntity]) : []);
}
//#endregion
//#region src/velair/controllers/template-actions.ts
function U(e) {
	return e;
}
function ka(e, t) {
	e._selectedTemplateKey = t;
	let n = e._scheduleTemplates().find((e) => e.key === t);
	if (e._templateDraftKey !== t && (e._resetTemplateDraft(n), e._templateApplyOpen = !1, e._templateApplyTargets = /* @__PURE__ */ new Set()), e._templateNameDraftKey === t) {
		e._saveMessage = void 0;
		return;
	}
	e._templateNameDraftKey = t, e._templateNameDraft = n ? e._templateLabel(n) : "", e._saveMessage = void 0;
}
function Aa(e, t) {
	let n = e._selectedTemplateKey;
	if (e._selectedTemplateKey = t, e._saveMessage = void 0, t) {
		if (!e._applySelectedTemplate()) {
			e._selectedTemplateKey = n;
			return;
		}
		e._selectedTemplateKey = "";
	}
}
function ja(e, t) {
	e._templateDraftKey = t?.key ?? "", e._templateDraftBlocks = t ? Ga(t.blocks) : [], e._templateDirty = !1;
}
function Ma(e, t) {
	let n = ["template-list-wrap"];
	return t > 5 && n.push("scrollable"), e._templateListCanScrollUp && n.push("can-scroll-up"), e._templateListCanScrollDown && n.push("can-scroll-down"), n.join(" ");
}
function Na(e) {
	let t = e.renderRoot.querySelector(".template-list");
	if (!(t instanceof HTMLElement)) {
		e._setTemplateListScrollIndicators(!1, !1);
		return;
	}
	let n = t.scrollHeight > t.clientHeight + 1, r = n && t.scrollTop > 1, i = n && t.scrollTop + t.clientHeight < t.scrollHeight - 1;
	e._setTemplateListScrollIndicators(r, i);
}
function Pa(e, t, n) {
	e._templateListCanScrollUp !== t && (e._templateListCanScrollUp = t), e._templateListCanScrollDown !== n && (e._templateListCanScrollDown = n);
}
function Fa(e, t) {
	return e._templateNameDraftKey === t.key ? e._templateNameDraft : e._templateLabel(t);
}
function Ia(e, t, n) {
	e._templateNameDraftKey = t, e._templateNameDraft = n, e._templateDirty = !0, e._saveMessage = void 0;
}
async function La(e) {
	let t = e._api();
	if (!t || e._templateAction) return;
	let n = e._newTemplateKey(), r = e._uniqueTemplateName(e._t("newTemplate"));
	e._templateAction = "save", e._error = void 0, e._saveMessage = void 0;
	try {
		let i = await t.setScheduleTemplate(n, r, []);
		e._applyScheduleData(i), e._selectedTemplateKey = n, e._templateNameDraftKey = n, e._templateNameDraft = r, e._resetTemplateDraft(e._scheduleTemplates().find((e) => e.key === n)), e._showSuccess(e._t("templateSaved"));
	} catch (t) {
		e._error = t instanceof Error ? t.message : e._t("unableSaveTemplate");
	} finally {
		e._templateAction = void 0;
	}
}
async function Ra(e, t) {
	let n = e._api();
	if (!n || e._templateAction) return;
	let r = e._templateNameInputValue(t).trim();
	if (!r) {
		e._error = e._t("templateNameRequired");
		return;
	}
	let i = e._normalizeDraftBlocks("template");
	if (!i.ok) {
		e._error = i.error;
		return;
	}
	e._templateAction = "save", e._error = void 0, e._saveMessage = void 0;
	try {
		let a = await n.setScheduleTemplate(t.key, r, i.blocks);
		e._applyScheduleData(a), e._selectedTemplateKey = t.key, e._templateNameDraftKey = t.key, e._templateNameDraft = r, e._resetTemplateDraft(e._scheduleTemplates().find((e) => e.key === t.key)), e._showSuccess(e._t("templateSaved"));
	} catch (t) {
		e._error = t instanceof Error ? t.message : e._t("unableSaveTemplate");
	} finally {
		e._templateAction = void 0;
	}
}
function za(e, t) {
	return Pn(t, e._scheduleTemplates());
}
function Ba(e) {
	e._templateApplyOpen = !e._templateApplyOpen, e._saveMessage = void 0;
}
function Va(e, t) {
	return In(e, t);
}
function Ha(e, t, n, r) {
	!k.includes(n) || !(e._data?.configured_entities ?? []).includes(t) || (e._templateApplyTargets = Ln(e._templateApplyTargets, t, n, r), e._saveMessage = void 0);
}
async function Ua(e, t) {
	let n = e._api();
	if (!n || e._applyingTemplateTargets || e._templateApplyTargets.size === 0) return;
	let r = e._normalizeDraftBlocks("template");
	if (!r.ok) {
		e._error = r.error;
		return;
	}
	let i = Rn(e._templateApplyTargets, e._data?.configured_entities ?? []);
	if (i.length) {
		for (let t of i) {
			let n = e._unsupportedModeError(r.blocks, t.entityId);
			if (n) {
				e._error = n;
				return;
			}
		}
		e._applyingTemplateTargets = !0, e._error = void 0, e._saveMessage = void 0;
		try {
			let a;
			for (let t of i) a = await n.setDailySchedule(t.entityId, t.weekday, e._clampBlocksForEntity(r.blocks, t.entityId));
			a && e._applyScheduleData(a, { forceDraft: !0 }), e._selectedTemplateKey = t.key, e._templateApplyTargets = /* @__PURE__ */ new Set(), e._templateApplyOpen = !1, e._showSuccess(e._t("appliedTemplateTargets", { count: i.length }));
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableCopy");
		} finally {
			e._applyingTemplateTargets = !1;
		}
	}
}
function Wa(e) {
	let t = e._scheduleTemplates().find((t) => t.key === e._selectedTemplateKey);
	if (!t) return !1;
	if (e._selectedEntity) {
		let n = e._unsupportedModeError(t.blocks, e._selectedEntity);
		if (n) return e._error = n, e._saveMessage = void 0, !1;
	}
	return e._draftBlocks.length && !window.confirm(e._t("confirmTemplate", {
		template: e._templateLabel(t),
		weekday: e._weekdayName(e._selectedWeekday)
	})) ? !1 : (e._draftBlocks = Ga(t.blocks), e._markDirty(), e._saveMessage = void 0, !0);
}
function Ga(e) {
	return e.map((e) => {
		let t = {
			action: e.action,
			hvac_mode: e.hvac_mode ?? "",
			start: e.start,
			temperature: e.temperature
		};
		return e.fan_mode && (t.fan_mode = e.fan_mode), e.preset_mode && (t.preset_mode = e.preset_mode), e.swing_mode && (t.swing_mode = e.swing_mode), e.swing_horizontal_mode && (t.swing_horizontal_mode = e.swing_horizontal_mode), String(e.humidity ?? "").trim() && (t.humidity = e.humidity), t;
	});
}
async function Ka(e, t) {
	let n = e._api();
	if (!n || e._templateAction) return;
	let r = e._scheduleTemplates().find((t) => t.key === e._selectedTemplateKey);
	if (!t && !r) return;
	let i = window.prompt(e._t("customTemplateName"), !t && r ? e._templateLabel(r) : "")?.trim();
	if (!i) return;
	let a = e._normalizeDraftBlocks();
	if (!a.ok) {
		e._error = a.error;
		return;
	}
	e._templateAction = "save", e._error = void 0, e._saveMessage = void 0;
	try {
		let o = t ? e._newTemplateKey() : r?.key ?? e._newTemplateKey(), s = await n.setScheduleTemplate(o, i, a.blocks);
		e._applyScheduleData(s), e._selectedTemplateKey = o, e._showSuccess(e._t("templateSaved"));
	} catch (t) {
		e._error = t instanceof Error ? t.message : e._t("unableSaveTemplate");
	} finally {
		e._templateAction = void 0;
	}
}
function qa() {
	return Fn();
}
async function Ja(e) {
	let t = e._api();
	if (!t || e._templateAction) return;
	let n = e._scheduleTemplates().find((t) => t.key === e._selectedTemplateKey);
	if (n && window.confirm(e._t("confirmDeleteTemplate", { template: e._templateLabel(n) }))) {
		e._templateAction = "delete", e._error = void 0, e._saveMessage = void 0;
		try {
			let r = await t.deleteScheduleTemplate(n.key);
			e._applyScheduleData(r), e._selectedTemplateKey = "", e._showSuccess(e._t("templateDeleted"));
		} catch (t) {
			e._error = t instanceof Error ? t.message : e._t("unableDeleteTemplate");
		} finally {
			e._templateAction = void 0;
		}
	}
}
//#endregion
//#region src/velair/host-types.ts
function Ya(e) {
	return e;
}
//#endregion
//#region src/velair/domain/schedule-compatibility.ts
var Xa = 1e-4;
function Za(e, t, n) {
	let r = 0;
	for (let [i, a] of Object.entries(e)) {
		let e = n(i);
		if (e === void 0 || !Number.isFinite(e) || e <= 0) continue;
		let [o, s] = t(i);
		for (let t of Object.values(a.schedule)) for (let n of t) {
			let t = n.temperature;
			if (typeof t != "number" || !Number.isFinite(t)) continue;
			let i = t < o || t > s, a = Math.abs(t / e - Math.round(t / e)) > Xa;
			(i || a) && (r += 1);
		}
	}
	return r;
}
//#endregion
//#region src/velair/views/notice-view.ts
function Qa(e, t, n) {
	return x`
    <div class=${`notice ${t}`}>
      <span>${n}</span>
      <button class="notice-close" type="button" title=${e._t("dismiss")} @click=${() => e._dismissNotice(t)}>
        <ha-icon icon="mdi:close"></ha-icon>
      </button>
      ${t === "success" ? x`
            <div class="notice-progress-track">
              <div class="notice-progress-fill" style=${`width: ${e._successNoticeProgress()}%;`}></div>
            </div>
          ` : C}
    </div>
  `;
}
//#endregion
//#region src/velair/domain/comfort.ts
function $a(e, t) {
	return {
		...eo(t),
		...e
	};
}
function eo(e) {
	let t = e.toUpperCase().includes("F");
	return {
		enabled: !1,
		temperature_entity_id: null,
		humidity_enabled: !0,
		humidity_entity_id: null,
		co2_entity_id: null,
		temperature_min: t ? 68 : 20,
		temperature_max: t ? 75 : 24,
		humidity_min: 40,
		humidity_max: 60,
		co2_attention: 1e3,
		co2_poor: 1500,
		stale_after_minutes: 120
	};
}
function to(e, t, n) {
	let r = e?.states ?? {}, i = Object.entries(r).filter(([e, r]) => {
		if (e === t) return !0;
		if (!e.startsWith("sensor.")) return !1;
		let i = String(r.attributes?.device_class ?? "").toLowerCase(), a = String(r.attributes?.unit_of_measurement ?? "").toLowerCase();
		return n === "temperature" ? i === "temperature" || a.includes("°") : n === "humidity" ? i === "humidity" || a === "%" : i === "carbon_dioxide" || a === "ppm";
	}).map(([e, t]) => ({
		entityId: e,
		label: t.attributes?.friendly_name || e
	})).sort((e, t) => e.label.localeCompare(t.label));
	return t && !i.some((e) => e.entityId === t) && i.unshift({
		entityId: t,
		label: t
	}), i;
}
function no(e) {
	return e?.availability === "current" && typeof e.value == "number" && typeof e.min == "number" && typeof e.max == "number";
}
function ro(e, t, n) {
	let r = Math.max(n - t, .1), i = t - r, a = n + r, o = (e - i) / (a - i) * 100;
	return Math.max(4, Math.min(96, o));
}
function io(e, t, n) {
	let r = Math.min(400, t * .5), i = Math.max(n * 1.25, r + 1), a = (e - r) / (i - r) * 100;
	return Math.max(4, Math.min(96, a));
}
//#endregion
//#region src/velair/views/comfort-view.ts
var ao = "__humidity_not_monitored__", oo = {
	showConfiguration: !0,
	showTemperature: !0,
	showHumidity: !0,
	showCo2: !0
}, so = {
	comfortTemperatureRange: "comfortTemperatureRangeHelp",
	comfortHumidityRange: "comfortHumidityRangeHelp",
	comfortCo2Limits: "comfortCo2LimitsHelp",
	comfortStaleAfter: "comfortStaleAfterHelp"
};
function co(e, t, n = {}) {
	let r = lo(n);
	return x`
    <section class="comfort-view">
      <header class="comfort-intro">
        <ha-icon icon="mdi:home-heart"></ha-icon>
        <span>
          <strong>${e._t("comfortIntroTitle")}</strong>
          <small>${e._t("comfortIntroDetail")}</small>
        </span>
      </header>
      ${t.length ? t.map((t) => uo(e, t, r)) : x`<span class="empty">${e._t("noManagedEntities")}</span>`}
    </section>
  `;
}
function lo(e) {
	return {
		...oo,
		...e
	};
}
function uo(e, t, n) {
	let r = e._entityExists(t), i = $a(e._data?.zones[t]?.comfort, e._temperatureUnit(t)), a = e._data?.comfort?.[t], o = r && e._expandedComfortZones.has(t), s = `comfort-zone-content-${t.replace(/[^a-zA-Z0-9_-]/g, "-")}`, c = r ? e._t(o ? "comfortCollapseClimate" : "comfortExpandClimate", { climate: e._friendlyEntityName(t) }) : e._t("comfortUnavailable");
	return x`
    <section class=${`comfort-zone ${i.enabled ? "enabled" : "disabled"} ${o ? "expanded" : "collapsed"}`}>
      <header class="comfort-zone-heading" @click=${(n) => {
		let r = n.target;
		r instanceof Element && r.closest(".comfort-zone-actions") || e._toggleComfortZone(t);
	}}>
        <button
          type="button"
          class="comfort-zone-toggle"
          title=${c}
          aria-label=${c}
          aria-expanded=${String(o)}
          aria-controls=${o ? s : C}
          ?disabled=${!r}
          @click=${(n) => {
		n.preventDefault(), n.stopPropagation(), e._toggleComfortZone(t);
	}}
        >
          <ha-icon
            class="comfort-expand-icon"
            icon=${o ? "mdi:chevron-down" : "mdi:chevron-right"}
          ></ha-icon>
          <span class="comfort-zone-identity">
            <strong title=${e._friendlyEntityName(t)}>
              ${e._friendlyEntityName(t)}
            </strong>
            <span>${t}</span>
          </span>
        </button>
        <div class="comfort-zone-actions" @click=${(e) => e.stopPropagation()}>
          ${yo(e, a)}
          <ha-switch
            .checked=${i.enabled}
            ?disabled=${e._settingsSaving || !r}
            @change=${(n) => {
		let r = !!n.target.checked;
		e._saveZoneComfort(t, { enabled: r });
	}}
          ></ha-switch>
        </div>
      </header>
      ${r && o ? x`
            <div id=${s} class="comfort-zone-content">
              ${i.enabled ? po(e, t, a, n) : fo(e)}
              ${n.showConfiguration ? bo(e, t, i) : C}
            </div>
          ` : C}
    </section>
  `;
}
function fo(e) {
	return x`
    <section class="comfort-assessment-card idle">
      <ha-icon icon="mdi:power-standby"></ha-icon>
      <span>${e._t("comfortDisabledDetail")}</span>
    </section>
  `;
}
function po(e, t, n, r = oo) {
	return n?.enabled ? x`
    <section class="comfort-assessment-card">
      <div class="comfort-assessment-heading">
        <span>
          <ha-icon icon=${Mo(n.condition)}></ha-icon>
          <strong>${jo(e, n)}</strong>
        </span>
        ${Ao(e, n.air_quality)}
      </div>
      ${mo(e, t, n, r)}
    </section>
  ` : fo(e);
}
function mo(e, t, n, r) {
	let i = r.showTemperature ? n.temperature : void 0, a = r.showHumidity ? n.humidity : void 0, o = no(i), s = no(a), c = r.showTemperature || r.showHumidity, l = r.showCo2 && ho(n.co2), u, d = !0;
	if (o && s) {
		let n = ro(i.value, i.min, i.max), r = 100 - ro(a.value, a.min, a.max), o = [
			"comfort-map-marker",
			r < 30 ? "label-below" : "",
			n < 18 ? "label-left" : "",
			n > 82 ? "label-right" : ""
		].filter(Boolean).join(" ");
		u = x`
      <div class="comfort-map">
        <div class="comfort-map-axis comfort-map-axis-y">
          <span>${e._t("comfortMoreHumid")}</span>
          <span>${e._t("comfortDrier")}</span>
        </div>
        <div
          class="comfort-map-plot"
          role="img"
          aria-label=${e._t("comfortMapCurrentPosition", {
			temperature: e._formatTemperature(i.value, t),
			humidity: `${Math.round(a.value)}%`
		})}
        >
          <span class="comfort-map-regions" aria-hidden="true">
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
            <span></span><span></span><span></span>
          </span>
          <span
            class="comfort-map-zone"
            role="img"
            aria-label=${e._t("comfortTargetZone")}
          ></span>
          <span
            class=${o}
            style=${`--comfort-x:${n}%;--comfort-y:${r}%`}
          >
            <span class="comfort-map-marker-label">
              <strong>${e._formatTemperature(i.value, t)}</strong>
              <small>${Math.round(a.value)}%</small>
            </span>
            <span class="comfort-map-marker-dot"></span>
          </span>
        </div>
        <div class="comfort-map-axis comfort-map-axis-x">
          <span>${e._t("comfortCooler")}</span>
          <span>${e._t("comfortWarmer")}</span>
        </div>
        <div class="comfort-map-legend">
          <span>
            <i class="comfort-legend-zone" aria-hidden="true"></i>
            ${e._t("comfortTargetZone")}
          </span>
          <span>
            <i class="comfort-legend-current" aria-hidden="true"></i>
            ${e._t("comfortCurrentReadings")}
          </span>
        </div>
      </div>
    `;
	} else o ? u = go(e, t, i, "comfortTemperature") : s ? u = go(e, t, a, "comfortHumidity") : c ? u = x`
      <div class="comfort-no-readings">
        <ha-icon icon=${n.data_quality === "stale" ? "mdi:clock-alert-outline" : "mdi:sensor-off"}></ha-icon>
        <span>${jo(e, n)}</span>
      </div>
    ` : (u = C, d = !1);
	return !d && !l ? C : x`
    <div class="comfort-visuals">
      ${u}
      ${l ? _o(e, n.co2) : C}
    </div>
  `;
}
function ho(e) {
	return e?.availability === "current" && typeof e.value == "number" && typeof e.attention == "number" && typeof e.max == "number";
}
function go(e, t, n, r) {
	let i = ro(n.value, n.min, n.max), a = n.metric === "temperature" ? e._formatTemperature(n.value, t) : `${Math.round(n.value)}%`, o = n.metric === "temperature" ? e._formatTemperature(n.min, t) : `${Math.round(n.min)}%`, s = n.metric === "temperature" ? e._formatTemperature(n.max, t) : `${Math.round(n.max)}%`;
	return x`
    <div class=${`comfort-range-scale metric-${n.metric}`}>
      <header>
        <span>${e._t(r)}</span>
        <strong>${a}</strong>
      </header>
      <div class="comfort-scale-track">
        <span class="comfort-scale-marker" style=${`--comfort-position:${i}%`}></span>
      </div>
      <footer class="comfort-range-limits">
        <span>${o}</span>
        <span>${s}</span>
      </footer>
    </div>
  `;
}
function _o(e, t) {
	if (t?.availability !== "current" || typeof t.value != "number" || typeof t.attention != "number" || typeof t.max != "number") return C;
	let n = io(t.value, t.attention, t.max), r = io(t.attention, t.attention, t.max), i = io(t.max, t.attention, t.max);
	return x`
    <div class="comfort-co2-scale">
      <header>
        <span>${e._t("comfortAirQuality")}</span>
        <strong>${Math.round(t.value)} ppm</strong>
      </header>
      <div
        class="comfort-co2-track"
        style=${`--comfort-position:${n}%;--comfort-attention:${r}%;--comfort-poor:${i}%`}
      >
        <span class="comfort-scale-marker"></span>
      </div>
      <footer>
        <span>${e._t("comfortAirQualityGood")}</span>
        <span>${e._t("comfortAirQualityElevated")}</span>
        <span>${e._t("comfortAirQualityPoor")}</span>
      </footer>
    </div>
  `;
}
function vo(e, t) {
	if (!t?.enabled || t.data_quality === "complete") return C;
	let n = t.data_issues.length ? t.data_issues.map((t) => e._t(Io(t))).join(" · ") : e._t(Fo(t.data_quality));
	return x`
    <span
      class="comfort-data-warning"
      tabindex="0"
      title=${n}
      aria-label=${e._t(Fo(t.data_quality))}
    >
      <ha-icon icon="mdi:alert-circle-outline"></ha-icon>
      <span class="comfort-help-tooltip" role="tooltip">${n}</span>
    </span>
  `;
}
function yo(e, t) {
	return x`
    <span class="comfort-assessment-summary">
      <span class="comfort-assessment-line">
        ${ko(e, t)}
        ${t ? Ao(e, t.air_quality) : C}
        ${vo(e, t)}
      </span>
    </span>
  `;
}
function bo(e, t, n) {
	let [r, i] = jn(e._temperatureUnit(t)), a = Co(e, t, n, "temperature_entity_id", "temperature"), o = Co(e, t, n, "humidity_entity_id", "humidity"), s = Co(e, t, n, "co2_entity_id", "co2");
	return x`
    <section class="comfort-config-section">
      <h3><ha-icon icon="mdi:clock-check-outline"></ha-icon>${e._t("comfortDataFreshness")}</h3>
      <div class="comfort-config-rows">
        ${Eo(e, t, "comfortStaleAfter", "stale_after_minutes", n.stale_after_minutes, 5, 1440, 5, e._t("minutesShort"))}
      </div>
    </section>
    ${xo(e, "comfortTemperature", "mdi:thermometer", So(e, t, n, "temperature_entity_id", "temperature", "comfortTemperatureSensor"), a ? To(e, t, "comfortTemperatureRange", "temperature_min", n.temperature_min, "temperature_max", n.temperature_max, r, i, .5, e._temperatureUnit(t), "comfortMinimum", "comfortMaximum") : C)}
    ${xo(e, "comfortHumidity", "mdi:water-percent", So(e, t, n, "humidity_entity_id", "humidity", "comfortHumiditySensor"), o ? To(e, t, "comfortHumidityRange", "humidity_min", n.humidity_min, "humidity_max", n.humidity_max, 0, 100, 1, "%", "comfortMinimum", "comfortMaximum") : C)}
    ${xo(e, "comfortCo2", "mdi:molecule-co2", So(e, t, n, "co2_entity_id", "co2", "comfortCo2Sensor"), s ? To(e, t, "comfortCo2Limits", "co2_attention", n.co2_attention, "co2_poor", n.co2_poor, 400, 1e4, 50, "ppm", "comfortCo2Attention", "comfortCo2Poor") : C)}
  `;
}
function xo(e, t, n, r, i) {
	return x`
    <section class="comfort-config-section comfort-metric-config-section">
      <h3><ha-icon icon=${n}></ha-icon>${e._t(t)}</h3>
      <div class="comfort-config-rows">
        ${r}
        ${i}
      </div>
    </section>
  `;
}
function So(e, t, n, r, i, a) {
	let o = n[r] ?? "", s = i === "humidity" && !n.humidity_enabled ? ao : o, c = to(e.hass, o, i), l = wo(e, t, n, r, i), u = i === "co2" ? "comfortDoNotMonitor" : "comfortSelectSensor";
	return x`
    <label class="comfort-config-row comfort-picker-row">
      ${Oo(e, a)}
      <span class="select-wrap comfort-select-wrap">
        <span class="comfort-select-control">
          <select
          .value=${s}
          value=${s}
          ?disabled=${e._settingsSaving}
          @change=${(n) => {
		let a = n.currentTarget.value.trim();
		if (i === "humidity") {
			if (a === ao) {
				e._saveZoneComfort(t, { humidity_enabled: !1 });
				return;
			}
			e._saveZoneComfort(t, {
				humidity_enabled: !0,
				[r]: a || null
			});
			return;
		}
		e._saveZoneComfort(t, { [r]: a || null });
	}}
        >
          <option value="" ?selected=${s === ""}>
            ${e._t(u)}
          </option>
          ${i === "humidity" ? x`
                <option
                  value=${ao}
                  ?selected=${s === ao}
                >
                  ${e._t("comfortDoNotMonitorHumidity")}
                </option>
              ` : C}
          ${c.map((e) => x`
              <option value=${e.entityId} ?selected=${e.entityId === s}>
                ${e.label} · ${e.entityId}
              </option>
            `)}
          </select>
        </span>
        <small class="comfort-selected-entity" title=${l}>${l}</small>
      </span>
    </label>
  `;
}
function Co(e, t, n, r, i) {
	if (i === "humidity" && !n.humidity_enabled) return !1;
	if (n[r]?.trim() || i === "temperature") return !0;
	if (i === "humidity") {
		let n = e.hass?.states?.[t]?.attributes;
		return !!(n && ("current_humidity" in n || "humidity" in n));
	}
	return !1;
}
function wo(e, t, n, r, i) {
	if (i === "humidity" && !n.humidity_enabled) return e._t("comfortNotMonitored");
	let a = n[r]?.trim();
	if (a) return a;
	if (i === "temperature") {
		let n = e._data?.zones[t]?.preconditioning?.room_temperature_entity_id;
		return e._t("comfortAutomaticSourceValue", { entity: n || t });
	}
	if (i === "humidity") {
		let n = e.hass?.states?.[t]?.attributes;
		if (n && ("current_humidity" in n || "humidity" in n)) return e._t("comfortAutomaticSourceValue", { entity: t });
	}
	return e._t("comfortNotMonitored");
}
function To(e, t, n, r, i, a, o, s, c, l, u, d, f) {
	return x`
    <label class="comfort-config-row comfort-threshold-row">
      ${Oo(e, n)}
      <span class="comfort-number-pair">
        <span class="comfort-number-field">
          <small>${e._t(d)}</small>
          ${Do(e, t, r, i, s, c, l)}
        </span>
        <span class="comfort-number-separator">–</span>
        <span class="comfort-number-field">
          <small>${e._t(f)}</small>
          ${Do(e, t, a, o, s, c, l)}
        </span>
        <span class="comfort-number-unit">${u}</span>
      </span>
    </label>
  `;
}
function Eo(e, t, n, r, i, a, o, s, c) {
	return x`
    <label class="comfort-config-row">
      ${Oo(e, n)}
      <span class="comfort-number-single">
        <span class="comfort-number-field comfort-number-field-single">
          <small aria-hidden="true">&nbsp;</small>
          ${Do(e, t, r, i, a, o, s)}
        </span>
        <span class="comfort-number-single-unit">${c}</span>
      </span>
    </label>
  `;
}
function Do(e, t, n, r, i, a, o) {
	return x`
    <input
      type="number"
      min=${String(i)}
      max=${String(a)}
      step=${String(o)}
      .value=${String(r)}
      ?disabled=${e._settingsSaving}
      @change=${(o) => {
		let s = Number(o.currentTarget.value), c = Math.min(a, Math.max(i, Number.isFinite(s) ? s : r));
		e._saveZoneComfort(t, { [n]: c });
	}}
    />
  `;
}
function Oo(e, t) {
	let n = so[t], r = n ? e._t(n) : "";
	return x`
    <span class="label comfort-config-label">
      <span>${e._t(t)}</span>
      ${n ? x`
            <span class="comfort-help" tabindex="0" aria-label=${r}>
              <ha-icon icon="mdi:information-outline"></ha-icon>
              <span class="comfort-help-tooltip" role="tooltip">${r}</span>
            </span>
          ` : C}
    </span>
  `;
}
function ko(e, t) {
	return x`
    <span class=${`comfort-condition-pill condition-${t?.condition ?? "monitoring_off"}`}>
      ${t ? jo(e, t) : e._t("comfortConditionMonitoringOff")}
    </span>
  `;
}
function Ao(e, t) {
	return t === "not_monitored" ? C : x`
    <span class=${`comfort-air-pill air-${t}`}>
      ${e._t(Po(t))}
    </span>
  `;
}
function jo(e, t) {
	return t.condition === "no_readings" && t.data_quality === "stale" ? e._t("comfortConditionReadingsOutdated") : e._t(No(t.condition));
}
function Mo(e) {
	return {
		cold: "mdi:snowflake-thermometer",
		cold_and_dry: "mdi:snowflake",
		cold_and_humid: "mdi:weather-snowy-rainy",
		comfortable: "mdi:check-circle-outline",
		dry: "mdi:water-off-outline",
		hot: "mdi:sun-thermometer-outline",
		hot_and_dry: "mdi:weather-sunny-alert",
		hot_and_humid: "mdi:weather-partly-rainy",
		humid: "mdi:water-percent",
		humidity_comfortable: "mdi:water-check-outline",
		monitoring_off: "mdi:power-standby",
		no_readings: "mdi:sensor-off",
		temperature_comfortable: "mdi:thermometer-check"
	}[e];
}
function No(e) {
	return {
		cold: "comfortConditionCold",
		cold_and_dry: "comfortConditionColdAndDry",
		cold_and_humid: "comfortConditionColdAndHumid",
		comfortable: "comfortConditionComfortable",
		dry: "comfortConditionDry",
		hot: "comfortConditionHot",
		hot_and_dry: "comfortConditionHotAndDry",
		hot_and_humid: "comfortConditionHotAndHumid",
		humid: "comfortConditionHumid",
		humidity_comfortable: "comfortConditionHumidityComfortable",
		monitoring_off: "comfortConditionMonitoringOff",
		no_readings: "comfortConditionNoReadings",
		temperature_comfortable: "comfortConditionTemperatureComfortable"
	}[e];
}
function Po(e) {
	return {
		elevated: "comfortAirQualityElevated",
		good: "comfortAirQualityGood",
		poor: "comfortAirQualityPoor",
		unavailable: "comfortAirQualityUnavailable"
	}[e];
}
function Fo(e) {
	return {
		partial: "comfortDataPartial",
		stale: "comfortDataStale",
		unavailable: "comfortDataUnavailable"
	}[e];
}
function Io(e) {
	return {
		co2_missing: "comfortDataIssueCo2Missing",
		co2_stale: "comfortDataIssueCo2Stale",
		humidity_missing: "comfortDataIssueHumidityMissing",
		humidity_stale: "comfortDataIssueHumidityStale",
		temperature_missing: "comfortDataIssueTemperatureMissing",
		temperature_stale: "comfortDataIssueTemperatureStale"
	}[e] ?? "comfortDataUnavailable";
}
//#endregion
//#region src/velair/controllers/overview-data.ts
function W(e) {
	return e;
}
function Lo(e, t, n) {
	let r = n?.override ?? e._data?.active_overrides?.[t];
	return zn(r) ? r : void 0;
}
function Ro(e) {
	return e._data ? e._orderedZoneIds(e._data.configured_entities).filter((t) => {
		let n = e._data?.zones[t];
		return !!Lo(e, t, n);
	}) : [];
}
function zo(e, t, n) {
	return Bn(n?.override) ? n?.override ?? void 0 : void 0;
}
function Bo(e, t, n) {
	let r = Number(n.temperature), i = N(n.until), a = typeof n.hvac_mode == "string" ? n.hvac_mode : "", o = [];
	return Number.isFinite(r) && o.push(e._formatTemperature(r, t)), a && o.push(e._modeLabel(a)), i && o.push(`${e._t("boostUntil")}: ${e._formatRemaining(Math.max(0, i - Date.now()))}`), o.join(" - ") || e._t("boostActive");
}
function Vo(e, t) {
	let n = N(t.started_at), r = N(t.until), i = [];
	return n && i.push(`${e._t("pauseFrom")}: ${e._formatDateTime(new Date(n).toISOString())}`), r ? (i.push(`${e._t("pauseTo")}: ${e._formatDateTime(new Date(r).toISOString())}`), i.push(`${e._t("pauseRemaining")}: ${e._formatRemaining(Math.max(0, r - Date.now()))}`), i.join(" - ")) : (i.push(e._t("pauseIndefinite")), i.join(" - "));
}
function Ho(e) {
	if (!e._data) return [];
	if (e._data.next_events.length) return e._data.next_events;
	let t = e._orderedZoneIds(e._data.configured_entities).map((t) => Uo(e, t, e._data?.zones[t])).filter((e) => !!e).sort((e, t) => new Date(e.when).getTime() - new Date(t.when).getTime());
	return t.length ? t : e._data.next_events;
}
function Uo(e, t, n) {
	return vn(t, n, Lo(e, t, n));
}
function Wo() {
	return Cn(/* @__PURE__ */ new Date());
}
//#endregion
//#region src/velair/domain/room-assist.ts
function Go(e, t) {
	return t === "cool" ? -Math.abs(e) : Math.abs(e);
}
//#endregion
//#region src/velair/views/overview-view.ts
function Ko(e) {
	let t = e._pauseExpirationMs();
	return t && t > Date.now() ? {
		detail: e._t("overviewStatusPausedDetail"),
		icon: "mdi:pause-circle",
		label: e._t("overviewStatusPaused"),
		state: "paused"
	} : e._data?.global.mode === "paused" || e._data?.operational_status === "paused" ? {
		detail: e._t("overviewStatusStoppedDetail"),
		icon: "mdi:stop-circle",
		label: e._t("overviewStatusStopped"),
		state: "stopped"
	} : {
		detail: e._t("overviewStatusRunningDetail"),
		icon: "mdi:play-circle",
		label: e._t("overviewStatusRunning"),
		state: "running"
	};
}
function qo(e, t) {
	if (!e._data) return C;
	let n = Ko(e);
	return x`
    <section class="overview-summary">
      <div class=${`overview-status-card status-${n.state}`}>
        <div class="overview-status-heading">
          <div class="overview-scheduler-state">
            <span class="label">${e._t("status")}</span>
            <span class=${`overview-state-value ${n.state}`}>
              <ha-icon icon=${n.icon}></ha-icon>
              <strong>${n.label}</strong>
            </span>
          </div>
          ${Es(e)}
          <span class="overview-scheduler-detail">${n.detail}</span>
        </div>
        ${Ds(e)}
      </div>
    </section>
  `;
}
function Jo(e, t) {
	if (!e._data) return C;
	let n = W(e), r = t ? new Set(t) : void 0, i = Ro(n).filter((e) => !r || r.has(e));
	return x`
    <section class="overview-boost-panel">
      ${i.length ? x`
            ${Ss(e._t("activeBoosts"), "mdi:lightning-bolt")}
            <div class="event-list overview-boost-list">
              ${i.map((t) => {
		let r = Lo(n, t, e._data?.zones[t]);
		return x`
                  <div class="event">
                    <div>
                      <strong class="overview-climate-name">${e._friendlyEntityName(t)}</strong>
                    </div>
                    ${r ? Yo(e, t, r) : x`<span>${e._t("boostActive")}</span>`}
                  </div>
                `;
	})}
            </div>
          ` : Ts(e._t("activeBoosts"), "mdi:lightning-bolt", e._t("noActiveBoosts"))}
    </section>
  `;
}
function Yo(e, t, n) {
	let r = Number(n.temperature), i = typeof n.until == "string" ? new Date(n.until).getTime() : void 0, a = typeof n.hvac_mode == "string" ? n.hvac_mode : "";
	return x`
    <div class="event-details">
      <span class="event-time">${i && !Number.isNaN(i) ? `${e._formatDateTime(new Date(i).toISOString())} (${e._formatRemaining(Math.max(0, i - Date.now()))})` : e._t("boostActive")}</span>
      <strong class="event-target">${Number.isFinite(r) ? e._formatTemperature(r, t) : "-"}</strong>
      <span class="event-mode">${a ? e._modeLabel(a) : e._t("keepMode")}</span>
    </div>
  `;
}
function Xo(e, t) {
	return !e._data || !t.length ? C : x`
    <section class="overview-zones">
      ${Ss(e._t("overviewZones"), "mdi:thermostat")}
      <div class="overview-zone-cards">
        ${t.map((t) => Qo(e, t))}
      </div>
    </section>
  `;
}
var Zo = {
	stopped: {
		icon: "mdi:stop-circle-outline",
		key: "overviewZoneStopped"
	},
	paused: {
		icon: "mdi:pause-circle",
		key: "overviewZonePaused"
	},
	boost: {
		icon: "mdi:lightning-bolt",
		key: "overviewZoneBoost"
	},
	preconditioning: {
		icon: "mdi:clock-fast",
		key: "overviewZonePreconditioning"
	},
	scheduled: {
		icon: "mdi:calendar-clock",
		key: "overviewZoneScheduled"
	},
	idle: {
		icon: "mdi:hand-back-right-outline",
		key: "overviewZoneIdle"
	}
};
function Qo(e, t) {
	let n = e._data?.zone_runtime?.[t], r = n != null, i = n ?? { state: "idle" }, a = e.hass?.states?.[t], o = a && a.state !== "off" && a.state !== "unknown" && a.state !== "unavailable", s = G(i.room_temperature) ?? (r ? void 0 : G(a?.attributes?.current_temperature)), c = G(i.target_temperature) ?? (!r && o ? G(a.attributes?.temperature) : void 0), l = G(i.applied_temperature), u = Zo[i.state], d = e._data?.room_sensor_assist?.[t], f = e._data?.comfort?.[t], p = !!(d && (d.status === "assisting" || d.status === "holding") && es(d)), ee = s !== void 0 || c !== void 0 || l !== void 0 && c !== void 0 && Math.abs(l - c) >= .05;
	return x`
    <article class=${`overview-zone-card state-${i.state}`}>
      <div class="overview-zone-card-heading">
        <div class="overview-zone-card-name">
          <strong>${e._friendlyEntityName(t)}</strong><span>${t}</span>
        </div>
        <div class="overview-zone-signals">
          ${as(e, d)}
          ${ss(e, f)}
        </div>
        ${$o(e, t, i, u)}
      </div>
      ${p || ee ? x`<div class="overview-zone-details">
        ${p ? ts(e, t, d) : x`<div class="overview-zone-metrics">
          ${s === void 0 ? C : os(e._t("overviewZoneRoom"), s, e, t)}
          ${c === void 0 ? C : os(e._t("overviewZoneTarget"), c, e, t)}
          ${l !== void 0 && c !== void 0 && Math.abs(l - c) >= .05 ? os(e._t("overviewZoneApplied"), l, e, t) : C}
        </div>`}
      </div>` : C}
    </article>`;
}
function $o(e, t, n, r) {
	let i = "";
	if (n.state === "paused" && (i = n.until ? e._t("overviewZoneResumes", { time: e._formatDateTime(n.until) }) : e._t("overviewZoneUntilResumed")), n.state === "boost" && n.until && (i = e._t("overviewZoneUntil", { time: e._formatDateTime(n.until) })), n.state === "preconditioning" && n.target_when && (i = e._t("overviewZoneReadyAt", { time: e._formatDateTime(n.target_when) })), n.state === "scheduled") {
		let r = e._data?.next_events?.find((e) => e.entity_id === t);
		i = r?.when ? e._t("overviewZoneNextAt", { time: e._formatDateTime(r.when) }) : n.hvac_mode ? e._modeLabel(n.hvac_mode) : "";
	}
	n.state === "idle" && n.hvac_mode && (i = e._t("overviewZoneManualMode", { mode: e._modeLabel(n.hvac_mode) })), n.state === "stopped" && (i = e._t("overviewZoneAutomationOff"));
	let a = e._t(r.key);
	return x`<section class=${`overview-zone-activity state-${n.state}`} aria-label=${i ? `${a}: ${i}` : a} title=${i || a}>
    <span class="overview-zone-activity-icon"><ha-icon icon=${r.icon}></ha-icon></span>
    <span class="overview-zone-activity-copy">
      <small class="overview-zone-activity-eyebrow">${e._t("overviewZoneCurrentState")}</small>
      <strong>${a}</strong>
      <small class="overview-zone-activity-context" aria-hidden=${i ? "false" : "true"}>${i || "\xA0"}</small>
    </span>
  </section>`;
}
function es(e) {
	return [
		e.room_temperature,
		e.climate_temperature,
		e.target_temperature,
		e.climate_target_temperature,
		e.applied_temperature,
		e.assist_delta
	].some((e) => G(e) !== void 0);
}
function ts(e, t, n) {
	let r = n.status === "assisting" || n.status === "holding" ? G(n.applied_temperature) ?? G(n.climate_target_temperature) : G(n.climate_target_temperature) ?? G(n.applied_temperature), i = G(n.assist_delta);
	return x`<div class="overview-assist-flow" aria-label=${e._t("overviewZoneRoomAssistThermalFlow")}>
    ${ns(e._t("overviewZoneTemperature"), [rs(e, t, "overviewZoneClimate", n.climate_temperature), rs(e, t, "overviewZoneSensor", n.room_temperature)])}
    ${ns(e._t("overviewZoneSetpoint"), [rs(e, t, "overviewZoneClimate", r), rs(e, t, "overviewZoneScheduledSetpoint", n.target_temperature)])}
    ${i === void 0 ? C : x`<span class="overview-assist-offset"><small>${e._t("overviewZoneOffset")}</small><strong>${is(e, t, Go(i, n.direction))}</strong></span>`}
  </div>`;
}
function ns(e, t) {
	let n = t.filter((e) => e !== C);
	return n.length ? x`<section class="overview-assist-group"><small>${e}</small><div>${n}</div></section>` : C;
}
function rs(e, t, n, r) {
	let i = G(r);
	return i === void 0 ? C : x`<span class="overview-assist-metric"><small>${e._t(n)}</small><strong>${e._formatTemperature(i, t)}</strong></span>`;
}
function is(e, t, n) {
	let r = e._formatTemperature(Math.abs(n), t);
	return n > 0 ? `+${r}` : n < 0 ? `-${r}` : r;
}
function as(e, t) {
	if (!t || !["assisting", "holding"].includes(t.status)) return C;
	let n = e._t(t.status === "holding" ? "overviewZoneRoomAssistHolding" : "overviewZoneRoomAssistActive");
	return cs("room-assist", "mdi:thermometer-auto", e._t("roomSensorAssistBadge"), n);
}
function G(e) {
	return typeof e == "number" && Number.isFinite(e) ? e : void 0;
}
function os(e, t, n, r) {
	return x`<span class="overview-zone-metric"><small>${e}</small><strong>${n._formatTemperature(t, r)}</strong></span>`;
}
function ss(e, t) {
	if (!t?.enabled) return C;
	let n = t.data_quality !== "complete" && t.condition !== "no_readings", r = {
		comfortable: "comfortConditionComfortable",
		temperature_comfortable: "comfortConditionTemperatureComfortable",
		humidity_comfortable: "comfortConditionHumidityComfortable",
		cold: "comfortConditionCold",
		hot: "comfortConditionHot",
		dry: "comfortConditionDry",
		humid: "comfortConditionHumid",
		cold_and_dry: "comfortConditionColdAndDry",
		cold_and_humid: "comfortConditionColdAndHumid",
		hot_and_dry: "comfortConditionHotAndDry",
		hot_and_humid: "comfortConditionHotAndHumid",
		no_readings: "comfortConditionNoReadings"
	}, i = {
		good: "comfortAirQualityGood",
		elevated: "comfortAirQualityElevated",
		poor: "comfortAirQualityPoor",
		unavailable: "comfortAirQualityUnavailable"
	}, a = ![
		"comfortable",
		"temperature_comfortable",
		"humidity_comfortable"
	].includes(t.condition), o = t.condition === "no_readings" ? "error" : a ? "warning" : "normal", s = t.air_quality === "poor" ? "error" : t.air_quality === "elevated" || t.air_quality === "unavailable" ? "warning" : "normal";
	return x`
    ${cs("comfort-environment", "mdi:home-thermometer-outline", e._t("overviewZoneComfortLabel"), e._t(r[t.condition] ?? "comfortConditionNoReadings"), o)}
    ${t.air_quality === "not_monitored" ? C : cs("comfort-air", "mdi:molecule-co2", e._t("overviewZoneAirLabel"), e._t(i[t.air_quality]), s)}
    ${n ? cs("comfort-data", "mdi:alert-circle-outline", e._t("overviewZoneDataLabel"), e._t("overviewZoneSensorIssue"), "warning") : C}
  `;
}
function cs(e, t, n, r, i = "normal") {
	return x`<span class=${`overview-zone-signal ${e} ${i}`} title=${`${n}: ${r}`}><ha-icon icon=${t}></ha-icon><span><small>${n}:</small><strong>${r}</strong></span></span>`;
}
function ls(e, t) {
	if (!e._data || !t.length) return C;
	let n = Hn(e._currentTimelineNow()), r = Wo();
	return x`
    <section class="overview-timeline-panel">
      ${Ss(e._t("todayTimeline"), "mdi:timeline-clock-outline")}
      <div class="overview-timeline-scroll">
        <div class="overview-timeline-layout">
          <div class="overview-timeline-names">
            <div class="overview-timeline-axis-spacer"></div>
            ${t.map((t) => ds(e, t))}
          </div>
          <div class="overview-timeline-rows" style=${`--overview-now-left: ${n.left}%;`}>
            <div class="overview-timeline-axis">
              <span>00</span>
              <span>06</span>
              <span>12</span>
              <span>18</span>
              <span>24</span>
              <div class="overview-timeline-now-label" title=${e._t("currentTime", { time: n.label })}>
                ${n.label}
              </div>
            </div>
            <div class="overview-timeline-now-line" aria-label=${e._t("currentTime", { time: n.label })}></div>
            ${t.map((t) => us(e, t, e._data?.zones[t]?.schedule?.[r] ?? []))}
          </div>
        </div>
      </div>
    </section>
  `;
}
function us(e, t, n) {
	let r = Gn(n), i = W(e), a = e._data?.zones[t], o = Lo(i, t, e._data?.zones[t]), s = zo(i, t, a), c = o ? Kn(o, e._currentTimelineNow()) : void 0, l = s ? qn(s, e._currentTimelineNow()) : void 0;
	return x`
    <div class=${l?.indefinite ? "overview-timeline-track paused-indefinite" : "overview-timeline-track"}>
      ${r.length || c || l ? r.map((n) => fs(e, t, n)) : x`<span class="overview-timeline-empty">${e._t("noBlocks")}</span>`}
      ${c && o ? ps(e, t, c, o) : C}
      ${l && s ? ms(e, t, l, s) : C}
      ${e._overviewTimelineDetail && e._overviewTimelineDetailEntityId === t ? x`
            <div
              class=${`overview-timeline-tap-detail ${bs(e._overviewTimelineDetailAnchor ?? 50)}`}
              role="status"
              style=${`--overview-detail-left: ${e._overviewTimelineDetailAnchor ?? 50}%;`}
            >
              <span>${e._overviewTimelineDetail}</span>
              <button
                type="button"
                title=${e._t("dismiss")}
                aria-label=${e._t("dismiss")}
                @click=${e._clearOverviewTimelineDetail}
              >
                <ha-icon icon="mdi:close"></ha-icon>
              </button>
            </div>
          ` : C}
    </div>
  `;
}
function ds(e, t) {
	let n = W(e), r = zo(n, t, e._data?.zones[t]), i = e._friendlyEntityName(t), a = r ? Vo(n, r) : "";
	return x`
    <div
      class=${r ? "overview-timeline-name paused" : "overview-timeline-name"}
      title=${r ? `${i} - ${e._t("pauseActive")} - ${a}` : i}
    >
      ${r ? x`<ha-icon icon="mdi:pause-circle" aria-hidden="true"></ha-icon>` : C}
      <span class="overview-climate-name">${i}</span>
    </div>
  `;
}
function fs(e, t, n) {
	let r = _s(e, t, n.block), i = hs(e, t, n.block), a = gs(e, t, n.block);
	return x`
    <button
      class=${[
		"overview-timeline-block",
		`mode-${Zn(n.block)}`,
		n.width < 12 ? "compact" : "",
		n.width < 6 ? "tiny" : ""
	].filter(Boolean).join(" ")}
      type="button"
      style=${`left: ${n.left}%; width: ${n.width}%;`}
      title=${r}
      aria-label=${r}
      @click=${(i) => e._showOverviewTimelineDetail(t, r, n.left + n.width / 2, i)}
    >
      <span class="overview-timeline-block-main">
        <span>${i}</span>
        ${a ? x`<small>${a}</small>` : C}
      </span>
    </button>
  `;
}
function ps(e, t, n, r) {
	let i = Zn({ hvac_mode: n.block.hvac_mode ?? e.hass?.states?.[t]?.state }), a = `${e._t("boostActive")} - ${e._formatScheduleTime(n.block.start)} - ${e._formatScheduleTime(ys(n.endMinute))} - ${Bo(W(e), t, r)}`;
	return x`
    <button
      class=${`overview-timeline-boost mode-${i}`}
      type="button"
      style=${`left: ${n.left}%; width: ${n.width}%;`}
      title=${a}
      aria-label=${a}
      @click=${(r) => e._showOverviewTimelineDetail(t, a, n.left + n.width / 2, r)}
    >
      <span class="overview-timeline-block-main">
        <ha-icon icon="mdi:lightning-bolt"></ha-icon>
        ${Number.isFinite(n.block.temperature) ? x`<span>${e._formatTemperature(Number(n.block.temperature), t)}</span>` : C}
      </span>
    </button>
  `;
}
function ms(e, t, n, r) {
	let i = `${e._t("pauseActive")} - ${Vo(W(e), r)}`;
	return x`
    <button
      class=${n.indefinite ? "overview-timeline-pause indefinite" : "overview-timeline-pause"}
      type="button"
      style=${`left: ${n.left}%; width: ${n.width}%;`}
      title=${i}
      aria-label=${i}
      @click=${(r) => e._showOverviewTimelineDetail(t, i, n.left + n.width / 2, r)}
    >
      <span class="overview-timeline-block-main">
        <ha-icon icon="mdi:pause"></ha-icon>
        <span>${e._t("pauseActive")}</span>
      </span>
    </button>
  `;
}
function hs(e, t, n) {
	return e._formatEventAction(vs(t, n));
}
function gs(e, t, n) {
	return n.action === "turn_off" || n.hvac_mode === "off" ? "" : e._formatEventMode(vs(t, n));
}
function _s(e, t, n) {
	let r = hs(e, t, n), i = gs(e, t, n);
	return [
		e._formatScheduleTime(n.start),
		r,
		i
	].filter(Boolean).join(" - ");
}
function vs(e, t) {
	return {
		action: t.action,
		entity_id: e,
		hvac_mode: t.hvac_mode ?? null,
		start: t.start,
		temperature: t.temperature ?? null,
		weekday: Wo(),
		when: (/* @__PURE__ */ new Date()).toISOString()
	};
}
function ys(e) {
	let t = Math.max(0, Math.min(1440, e)), n = Math.floor(t / 60), r = t % 60;
	return `${String(n).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}
function bs(e) {
	return e >= 72 ? "align-end" : e <= 28 ? "align-start" : "align-center";
}
function xs(e, t) {
	let n = t ? new Set(t) : void 0, r = Ho(W(e)).filter((e) => !n || n.has(e.entity_id)), i = r.some((e) => e.target_when && e.target_when !== e.when);
	return r.length ? x`
    <section class="next">
      ${Ss(e._t(r.length === 1 ? "nextEvent" : "nextEvents"), "mdi:calendar-clock")}
      <div class=${`event-list ${i ? "has-preconditioning" : ""}`}>
        ${r.map((t) => Cs(e, t))}
      </div>
    </section>
  ` : x`
      <section class="next">
        ${Ts(e._t("nextEvent"), "mdi:calendar-clock", e._t("noUpcomingEvent"))}
      </section>
    `;
}
function Ss(e, t) {
	return x`
    <div class="overview-section-title section-heading">
      <ha-icon icon=${t}></ha-icon>
      <span class="section-label">${e}</span>
    </div>
  `;
}
function Cs(e, t) {
	return x`
    <div class="event">
      <div class="event-identity">
        <strong class="overview-climate-name">${e._friendlyEntityName(t.entity_id)}</strong>
      </div>
      ${ws(e, t)}
    </div>
  `;
}
function ws(e, t) {
	let n = !!(t.target_when && t.target_when !== t.when), r = e._changedNextEventIds?.has(t.entity_id) ? `next-event-updated update-${e._nextEventChangeRevision % 2 == 0 ? "even" : "odd"}` : "";
	return x`
    <div class=${`event-details ${n ? "preconditioned" : ""}`}>
      ${n ? x`
            <span class="event-time event-time-sequence">
              <span class=${`event-time-flow ${r}`}>
                <ha-icon
                  class="preconditioning-icon"
                  icon="mdi:clock-fast"
                  title=${e._t("preconditioning")}
                  aria-label=${e._t("preconditioning")}
                ></ha-icon>
                <span class="preconditioning-start">${e._formatDateTime(t.when)}</span>
                <ha-icon
                  class="preconditioning-arrow"
                  icon="mdi:arrow-left"
                  aria-hidden="true"
                ></ha-icon>
                <span class="target-time">${e._formatDateTime(String(t.target_when))}</span>
              </span>
            </span>
          ` : x`
            <span class="event-time">
              <span class=${`event-time-flow event-time-single ${r}`}><span class="target-time">${e._formatDateTime(t.when)}</span></span>
            </span>
          `}
      <strong class="event-target">${e._formatEventAction(t)}</strong>
      <span class="event-mode">${e._formatEventMode(t)}</span>
    </div>
  `;
}
function Ts(e, t, n) {
	return x`
    <div class="overview-empty-state">
      <ha-icon icon=${t}></ha-icon>
      <div class="overview-empty-copy">
        <span class="section-label">${e}</span>
        <span class="overview-muted">${n}</span>
      </div>
    </div>
  `;
}
function Es(e) {
	let t = e._canResumeScheduler();
	return x`
    <div class="overview-controls">
      <label class="overview-pause-control">
        <span class="overview-pause-input">
          <input
            type="number"
            min="1"
            step="5"
            aria-label=${e._t("pauseDuration")}
            .value=${String(e._pauseDurationMinutes)}
            @input=${(t) => {
		e._pauseDurationMinutes = Math.max(1, Math.round(Number(e._inputValue(t)) || 1));
	}}
          />
          <span class="overview-pause-unit">min</span>
          <button
            class="overview-inline-button warning"
            type="button"
            title=${e._t("pause")}
            aria-label=${e._t("pause")}
            ?disabled=${e._controlAction === "pause"}
            @click=${() => e._pauseScheduler(!1, { showSuccess: !1 })}
          >
            <ha-icon icon="mdi:pause"></ha-icon>
          </button>
        </span>
      </label>
      <button
        class="overview-inline-button danger"
        type="button"
        title=${e._t("stop")}
        aria-label=${e._t("stop")}
        ?disabled=${e._controlAction === "pause"}
        @click=${() => e._pauseScheduler(!0, { showSuccess: !1 })}
      >
        <ha-icon icon="mdi:stop"></ha-icon>
      </button>
      <button
        class="overview-inline-button resume"
        type="button"
        title=${e._t("resume")}
        aria-label=${e._t("resume")}
        ?disabled=${!t || e._controlAction === "resume"}
        @click=${() => e._resumeScheduler({ showSuccess: !1 })}
      >
        <ha-icon icon="mdi:play"></ha-icon>
      </button>
    </div>
  `;
}
function Ds(e) {
	let t = e._pauseExpirationMs();
	if (!t || t <= Date.now()) return C;
	let n = Math.max(0, t - Date.now()), r = e._pauseProgressPercent(t);
	return x`
    <div class="pause-progress">
      <div>
        <span>${e._t("pauseRemaining")}: ${e._formatRemaining(n)}</span>
      </div>
      <div class="progress-track">
        <div class="progress-fill" style=${`width: ${r}%;`}></div>
      </div>
    </div>
  `;
}
//#endregion
//#region src/velair/domain/preconditioning.ts
function Os(e, t) {
	let n = e?.config?.unit_system?.temperature, r = e?.states ?? {}, i = Object.entries(r).filter(([e, r]) => {
		if (!e.startsWith("sensor.")) return !1;
		let i = r.attributes ?? {};
		return i.device_class === "temperature" || n !== void 0 && i.unit_of_measurement === n || e === t;
	}).map(([e, t]) => {
		let n = t.attributes?.friendly_name ?? e, r = t.attributes?.unit_of_measurement ?? "", i = As(t.state, r);
		return {
			entityId: e,
			label: i ? `${n} (${i})` : `${n} (${e})`
		};
	}).sort((e, t) => e.label.localeCompare(t.label));
	return t && !i.some((e) => e.entityId === t) && i.push({
		entityId: t,
		label: t
	}), i;
}
function ks(e, t) {
	return {
		enabled: !!e?.enabled,
		max_lead_minutes: Number(e?.max_lead_minutes ?? 1440),
		minimum_delta_temperature: Number(e?.minimum_delta_temperature ?? En(t)),
		learning_history_size: Number(e?.learning_history_size ?? 120),
		similar_sample_count: Number(e?.similar_sample_count ?? 25),
		comfort_percentile: Number(e?.comfort_percentile ?? 80),
		adaptive_percentile_enabled: e?.adaptive_percentile_enabled ?? !0,
		partial_expiry_days: Number(e?.partial_expiry_days ?? 30),
		recency_decay_days: Number(e?.recency_decay_days ?? 30),
		min_start_minutes: Number(e?.min_start_minutes ?? 10),
		fallback_minutes_per_degree: Number(e?.fallback_minutes_per_degree ?? On(t)),
		use_outdoor_temperature: e?.use_outdoor_temperature ?? !0,
		outdoor_temperature_entity_id: e?.outdoor_temperature_entity_id ?? null,
		room_temperature_entity_id: e?.room_temperature_entity_id ?? null,
		room_sensor_assist_enabled: e?.room_sensor_assist_enabled ?? !1,
		room_sensor_assist_max_delta: Number(e?.room_sensor_assist_max_delta ?? Dn(t)),
		room_sensor_assist_debounce_seconds: Number(e?.room_sensor_assist_debounce_seconds ?? 20)
	};
}
function As(e, t) {
	return e === void 0 || e === "unknown" || e === "unavailable" || Number.isNaN(Number(e)) ? "" : `${e}${t ? ` ${t}` : ""}`;
}
//#endregion
//#region src/velair/views/preconditioning-view.ts
var js = {
	preconditioningAdaptivePercentile: "preconditioningAdaptivePercentileHelp",
	preconditioningComfortPercentile: "preconditioningComfortPercentileHelp",
	preconditioningFallbackMinutesPerDegree: "preconditioningFallbackMinutesPerDegreeHelp",
	preconditioningHistorySize: "preconditioningHistorySizeHelp",
	preconditioningMaxLead: "preconditioningMaxLeadHelp",
	preconditioningMinimumDelta: "preconditioningMinimumDeltaHelp",
	preconditioningMinStart: "preconditioningMinStartHelp",
	preconditioningOutdoorTemperatureEntity: "preconditioningOutdoorTemperatureEntityHelp",
	preconditioningPartialExpiry: "preconditioningPartialExpiryHelp",
	preconditioningRecencyDecay: "preconditioningRecencyDecayHelp",
	preconditioningSimilarSamples: "preconditioningSimilarSamplesHelp",
	preconditioningUseOutdoorTemperature: "preconditioningUseOutdoorTemperatureHelp"
};
function Ms(e, t) {
	return x`
    <section class="preconditioning-view">
      <header class="preconditioning-intro">
        <ha-icon icon="mdi:clock-fast"></ha-icon>
        <span>
          <strong>${e._t("preconditioningIntroTitle")}</strong>
          <small>${e._t("preconditioningIntroDetail")}</small>
        </span>
      </header>
      ${t.length ? t.map((t) => Ns(e, t)) : x`<span class="empty">${e._t("noManagedEntities")}</span>`}
    </section>
  `;
}
function Ns(e, t) {
	let n = e._entityExists(t), r = e._temperatureUnit?.(t) ?? "°C", i = ks(e._data?.zones[t]?.preconditioning, r), a = e._data?.preconditioning_learning?.[t], o = n && e._expandedPreconditioningZones.has(t), s = `preconditioning-zone-content-${t.replace(/[^a-zA-Z0-9_-]/g, "-")}`, c = n ? e._t(o ? "preconditioningCollapseClimate" : "preconditioningExpandClimate", { climate: e._friendlyEntityName(t) }) : e._t("preconditioningUnavailable");
	return x`
    <section class=${`preconditioning-zone ${i.enabled ? "enabled" : "disabled"} ${o ? "expanded" : "collapsed"}`}>
      <header class="preconditioning-zone-heading" @click=${(r) => {
		if (!n) return;
		let i = r.target;
		i instanceof Element && i.closest(".preconditioning-zone-actions") || e._togglePreconditioningZone(t);
	}}>
        <button
          type="button"
          class="preconditioning-zone-toggle"
          title=${c}
          aria-label=${c}
          aria-expanded=${String(o)}
          aria-controls=${o ? s : C}
          ?disabled=${!n}
          @click=${(r) => {
		r.preventDefault(), r.stopPropagation(), n && e._togglePreconditioningZone(t);
	}}
        >
          <ha-icon
            class="preconditioning-expand-icon"
            icon=${o ? "mdi:chevron-down" : "mdi:chevron-right"}
          ></ha-icon>
          <span class="preconditioning-zone-identity">
            <strong title=${e._friendlyEntityName(t)}>
              ${e._friendlyEntityName(t)}
            </strong>
            <span>${t}</span>
          </span>
        </button>
        <div class="preconditioning-zone-actions" @click=${(e) => e.stopPropagation()}>
          <button
            type="button"
            class="icon-button preconditioning-settings-reset"
            title=${e._t("preconditioningResetSettings")}
            aria-label=${e._t("preconditioningResetSettings")}
            ?disabled=${e._settingsSaving}
            @click=${() => e._resetZonePreconditioningSettings(t)}
          >
            <ha-icon icon="mdi:restore"></ha-icon>
          </button>
          <span
            class=${n ? "preconditioning-enable-control" : "preconditioning-enable-control unavailable"}
            title=${n ? "" : e._t("preconditioningUnavailable")}
          >
            <ha-switch
              .checked=${i.enabled}
              ?disabled=${e._settingsSaving || !n}
              @change=${(n) => e._saveZonePreconditioning(t, { enabled: !!n.target.checked })}
            ></ha-switch>
          </span>
        </div>
        ${n ? C : x`<span class="preconditioning-unavailable-message">
              ${e._t("preconditioningUnavailable")}
            </span>`}
      </header>
      ${n && o ? x`
            <div id=${s} class="preconditioning-zone-content">
              ${Ps(e, t, i)}
              ${i.enabled ? Is(e, t, a) : C}
            </div>
          ` : C}
    </section>
  `;
}
function Ps(e, t, n) {
	let r = e._temperatureUnit?.(t) ?? "°C", i = An(r);
	return x`
    <div class="preconditioning-config-sections">
      ${Fs(e, "preconditioningTiming", "mdi:timer-outline", x`
          ${q(e, t, "preconditioningMinStart", n.min_start_minutes, "min_start_minutes", 0, 1440, 5)}
          ${q(e, t, "preconditioningMaxLead", n.max_lead_minutes, "max_lead_minutes", 0, 1440, 15)}
          ${q(e, t, "preconditioningMinimumDelta", n.minimum_delta_temperature, "minimum_delta_temperature", 0, kn(r, 5), .1, "", { labelUnit: r })}
          ${q(e, t, "preconditioningFallbackMinutesPerDegree", n.fallback_minutes_per_degree, "fallback_minutes_per_degree", i[0], i[1], .1, "", { labelUnit: `${e._t("minutesShort")}/${r}` })}
        `)}
      ${Fs(e, "preconditioningModel", "mdi:tune-variant", x`
          ${q(e, t, "preconditioningComfortPercentile", n.comfort_percentile, "comfort_percentile", 50, 95, 5)}
          ${Xs(e, t, "preconditioningAdaptivePercentile", n.adaptive_percentile_enabled, "adaptive_percentile_enabled")}
          ${q(e, t, "preconditioningSimilarSamples", n.similar_sample_count, "similar_sample_count", 5, 100, 5)}
        `)}
      ${Fs(e, "preconditioningHistory", "mdi:history", x`
          ${q(e, t, "preconditioningHistorySize", n.learning_history_size, "learning_history_size", 10, 500, 10)}
          ${q(e, t, "preconditioningPartialExpiry", n.partial_expiry_days, "partial_expiry_days", 1, 365, 1)}
          ${q(e, t, "preconditioningRecencyDecay", n.recency_decay_days, "recency_decay_days", 1, 365, 1)}
        `)}
      ${Fs(e, "preconditioningOutdoorContext", "mdi:weather-partly-cloudy", x`
          ${Xs(e, t, "preconditioningUseOutdoorTemperature", n.use_outdoor_temperature, "use_outdoor_temperature")}
          ${Zs(e, t, "preconditioningOutdoorTemperatureEntity", n.outdoor_temperature_entity_id ?? "", "outdoor_temperature_entity_id", { inactive: !n.use_outdoor_temperature })}
        `)}
    </div>
  `;
}
function Fs(e, t, n, r) {
	return x`
    <section class="preconditioning-config-section">
      <h3><ha-icon icon=${n}></ha-icon>${e._t(t)}</h3>
      <div class="preconditioning-config-rows">${r}</div>
    </section>
  `;
}
function Is(e, t, n) {
	if (!n) return C;
	let r = [n.heat.status === "unsupported" ? void 0 : Ls(e, t, "heat", n.heat), n.cool.status === "unsupported" ? void 0 : Ls(e, t, "cool", n.cool)].filter(Boolean);
	return x`
    <div class=${`preconditioning-learning ${n.status}`}>
      <h3 class="preconditioning-learning-heading">
        <ha-icon icon="mdi:chart-line"></ha-icon>
        ${e._t("preconditioningLearningStatus")}
      </h3>
      <div class="preconditioning-directions">
        ${r}
      </div>
    </div>
  `;
}
function Ls(e, t, n, r) {
	let i = e._t(n === "heat" ? "preconditioningHeat" : "preconditioningCool"), a = e._t(Ys(r.status)), o = r.total_samples, s = r.model_source === "history", c = e._t(s ? "preconditioningModelHistory" : "preconditioningModelInitial"), l = r.sample_count >= r.required_samples ? String(r.sample_count) : e._t("preconditioningDirectionSamples", {
		count: r.sample_count,
		required: r.required_samples
	});
	return x`
    <div class=${`preconditioning-direction ${n} ${r.status}`}>
      <div class="preconditioning-direction-heading">
        <span>
          <ha-icon icon=${n === "heat" ? "mdi:fire" : "mdi:snowflake"}></ha-icon>
          ${i}
        </span>
        <button
          type="button"
          class="icon-button preconditioning-learning-reset"
          title=${e._t("preconditioningResetLearning")}
          aria-label=${e._t("preconditioningResetLearning")}
          ?disabled=${o === 0 || e._settingsSaving}
          @click=${() => e._resetZonePreconditioningLearning(t, n, i)}
        >
          <ha-icon icon="mdi:restore"></ha-icon>
        </button>
      </div>
      <div class="preconditioning-learning-status-card">
        <div class="preconditioning-learning-summary">
          ${Ks(e._t("preconditioningDirectionStatus"), a, r.status === "ready" ? "mdi:check-circle" : "mdi:progress-clock", r.status)}
          ${Ks(e._t("preconditioningModelSource"), c, s ? "mdi:chart-timeline-variant" : "mdi:calculator-variant-outline", s ? "history" : "initial")}
        </div>
        <div class="preconditioning-sample-card">
          <div class="preconditioning-sample-chips">
            ${qs("complete", e._t("preconditioningReachedEvents"), l)}
            ${qs("partial", e._t("preconditioningPartialEvents"), String(r.partial_sample_count ?? 0))}
            ${qs("invalid", e._t("preconditioningInvalidEvents"), String(r.invalid_sample_count ?? 0))}
          </div>
        </div>
      </div>
      ${Rs(e, t, n)}
    </div>
  `;
}
function Rs(e, t, n) {
	let r = Us(e, t, n);
	if (!r) {
		let t = e._t(n === "heat" ? "preconditioningHeat" : "preconditioningCool");
		return x`
      <section class="preconditioning-prediction empty">
        <div class="preconditioning-prediction-heading">
          <span>${e._t("preconditioningNextBlock")}</span>
          ${zs(e)}
        </div>
        <div class="preconditioning-prediction-empty">
          <ha-icon icon="mdi:calendar-search"></ha-icon>
          <span>${e._t("preconditioningNoUpcomingDirectionEvent", { direction: t })}</span>
        </div>
      </section>
    `;
	}
	let i = r.target_when && r.target_when !== r.when ? r.target_when : r.when, a = Gs(r.when, i), o = a > 0, s = o ? e._t("preconditioningLeadTime", { minutes: a }) : e._t("preconditioningNormalStart");
	return x`
    <section class=${`preconditioning-prediction ${n} ${o ? "early" : "normal"}`}>
      <div class="preconditioning-prediction-heading">
        <span>${e._t("preconditioningNextBlock")}</span>
        ${zs(e)}
      </div>
      <div class=${`preconditioning-block-preview ${o ? "with-prestart" : "normal-start"}`}>
        ${o ? x`
              <div class="preconditioning-prestart">
                <small>${e._t("preconditioningStarts")}</small>
                <strong>${e._formatDateTime(r.when)}</strong>
                <span>${s}</span>
              </div>
            ` : C}
        <div class=${`preconditioning-preview-block mode-${n}`}>
          <small>${e._t("preconditioningTargetBy")}</small>
          <strong>${e._formatDateTime(i)}</strong>
          <span>${e._formatEventAction(r)}</span>
          <span>${e._formatEventMode(r)}</span>
        </div>
      </div>
      ${r.preconditioning_diagnostics ? Bs(e, r.preconditioning_diagnostics) : C}
    </section>
  `;
}
function zs(e) {
	let t = e._t("preconditioningLivePredictionHelp");
	return x`
    <span class="preconditioning-live-label">
      <span>${e._t("preconditioningLivePrediction")}</span>
      <span
        class="preconditioning-help"
        tabindex="0"
        aria-label=${t}
        @click=${(e) => {
		e.preventDefault(), e.stopPropagation();
	}}
      >
        <ha-icon icon="mdi:information-outline"></ha-icon>
        <span class="preconditioning-help-tooltip" role="tooltip">${t}</span>
      </span>
    </span>
  `;
}
function Bs(e, t) {
	return x`
    <details class="preconditioning-calculation-details">
      <summary>
        <ha-icon icon="mdi:calculator-variant-outline"></ha-icon>
        <span>${e._t("preconditioningCalculationDetails")}</span>
      </summary>
      <div class="preconditioning-calculation-grid">
        <div class="preconditioning-calculation-row context">
          ${K(e._t("preconditioningCalculationSamples"), e._t("preconditioningCalculationSampleCounts", {
		reached: t.complete_sample_count,
		partial: t.partial_sample_count,
		invalid: t.invalid_sample_count
	}), "samples")}
          ${K(e._t("preconditioningSimilarSamples"), String(t.similar_sample_count), "compact")}
          ${K(e._t("preconditioningComfortPercentileLabel"), `${t.comfort_percentile}%`, "compact")}
        </div>
        <div class="preconditioning-calculation-row estimates">
          ${K(e._t("preconditioningCalculationReachedEstimate"), Hs(e, t.complete_estimate_minutes))}
          ${K(e._t("preconditioningCalculationPartialFloor"), Hs(e, t.partial_floor_minutes))}
        </div>
        <div class=${`preconditioning-calculation-row result ${Vs(t) ? "without-rounded" : "with-rounded"}`}>
          ${K(e._t("preconditioningCalculationCombined"), Hs(e, t.combined_estimate_minutes))}
          ${Vs(t) ? C : K(e._t("preconditioningCalculationRounded"), Hs(e, t.rounded_estimate_minutes))}
          ${K(e._t("preconditioningCalculationFinalLead"), Hs(e, t.final_lead_minutes), "final")}
        </div>
      </div>
    </details>
  `;
}
function Vs(e) {
	return Math.round(e.combined_estimate_minutes * 10) / 10 === e.rounded_estimate_minutes;
}
function K(e, t, n = "") {
	return x`
    <span class=${`preconditioning-calculation-item ${n}`}>
      <small
        class="preconditioning-calculation-label"
        tabindex="0"
        title=${e}
        aria-label=${e}
      >
        <span class="preconditioning-calculation-label-text">${e}</span>
        <span class="preconditioning-calculation-tooltip" role="tooltip">${e}</span>
      </small>
      <strong>${t}</strong>
    </span>
  `;
}
function Hs(e, t) {
	if (typeof t != "number" || !Number.isFinite(t)) return "-";
	let n = Math.round(t * 10) / 10;
	return e._t("preconditioningFallbackLead", { minutes: n });
}
function Us(e, t, n) {
	return (e._data?.next_events ?? []).find((e) => e.entity_id === t && Ws(e) === n && typeof e.temperature == "number");
}
function Ws(e) {
	let t = e.preconditioning_diagnostics?.direction;
	if (t === "heat" || t === "cool") return t;
	if (e.hvac_mode === "heat" || e.hvac_mode === "cool") return e.hvac_mode;
}
function Gs(e, t) {
	let n = new Date(e).getTime(), r = new Date(t).getTime();
	return Number.isNaN(n) || Number.isNaN(r) || r <= n ? 0 : Math.round((r - n) / 6e4);
}
function Ks(e, t, n, r) {
	return x`
    <div class=${`preconditioning-learning-indicator ${r}`}>
      <ha-icon icon=${n}></ha-icon>
      <span>
        <small>${e}</small>
        <strong>${t}</strong>
      </span>
    </div>
  `;
}
function qs(e, t, n) {
	return x`
    <span class=${`preconditioning-sample-chip ${e}`}>
      <span>${t}:</span>
      <strong>${n}</strong>
    </span>
  `;
}
function Js(e, t, n = "") {
	let r = js[t], i = r ? e._t(r) : "";
	return x`
    <span class="label preconditioning-config-label">
      <span>${e._t(t)}${n ? ` (${n})` : ""}</span>
      ${r ? x`
            <span
              class="preconditioning-help"
              tabindex="0"
              aria-label=${i}
              @click=${(e) => {
		e.preventDefault(), e.stopPropagation();
	}}
            >
              <ha-icon icon="mdi:information-outline"></ha-icon>
              <span class="preconditioning-help-tooltip" role="tooltip">${i}</span>
            </span>
          ` : C}
    </span>
  `;
}
function Ys(e) {
	return e === "ready" ? "preconditioningLearningReady" : e === "disabled" ? "preconditioningLearningDisabled" : "preconditioningLearning";
}
function q(e, t, n, r, i, a, o, s, c = "", l = {}) {
	let u = e._settingsSaving || !!l.inactive;
	return x`
    <label class=${`preconditioning-config-row ${l.inactive ? "inactive" : ""}`}>
      ${Js(e, n, l.labelUnit)}
      <span class="preconditioning-number-input"><input
        type="number"
        min=${String(a)}
        max=${String(o)}
        step=${String(s)}
        .value=${String(r)}
        ?disabled=${u}
        @change=${(n) => {
		if (u) return;
		let s = Number(n.currentTarget.value), c = Math.min(o, Math.max(a, Number.isFinite(s) ? s : r));
		e._saveZonePreconditioning(t, { [i]: c });
	}}
      />${c ? x`<span>${c}</span>` : C}</span>
    </label>
  `;
}
function Xs(e, t, n, r, i, a = {}) {
	let o = e._settingsSaving || !!a.inactive;
	return x`
    <label class=${`preconditioning-config-row preconditioning-toggle-row ${a.inactive ? "inactive" : ""}`}>
      ${Js(e, n)}
      <ha-switch
        .checked=${r}
        ?disabled=${o}
        @change=${(n) => e._saveZonePreconditioning(t, { [i]: !!n.target.checked })}
      ></ha-switch>
    </label>
  `;
}
function Zs(e, t, n, r, i, a = {}) {
	let o = e._settingsSaving || !!a.inactive, s = a.inactive ? "" : r, c = Os(e.hass, r);
	return x`
    <label class=${`preconditioning-config-row preconditioning-sensor-row ${a.inactive ? "inactive" : ""}`}>
      ${Js(e, n)}
      <span class="select-wrap">
        <select
          .value=${s}
          value=${s}
          ?disabled=${o}
          @change=${(n) => {
		if (o) return;
		let r = n.currentTarget.value.trim();
		e._saveZonePreconditioning(t, { [i]: r || null });
	}}
        >
          <option value="" ?selected=${s === ""}>
            ${e._t(a.inactive ? "preconditioningOutdoorDisabled" : "preconditioningSelectOutdoorSensor")}
          </option>
          ${c.map((e) => x`
              <option value=${e.entityId} ?selected=${e.entityId === s}>
                ${e.label}
              </option>
            `)}
        </select>
      </span>
    </label>
  `;
}
//#endregion
//#region node_modules/lit-html/directive.js
var Qs = (e) => (...t) => ({
	_$litDirective$: e,
	values: t
}), $s = class {
	constructor(e) {}
	get _$AU() {
		return this._$AM._$AU;
	}
	_$AT(e, t, n) {
		this._$Ct = e, this._$AM = t, this._$Ci = n;
	}
	_$AS(e, t) {
		return this.update(e, t);
	}
	update(e, t) {
		return this.render(...t);
	}
}, { I: ec } = ze, tc = {}, nc = (e, t = tc) => e._$AH = t, rc = Qs(class extends $s {
	constructor() {
		super(...arguments), this.key = C;
	}
	render(e, t) {
		return this.key = e, t;
	}
	update(e, [t, n]) {
		return t !== this.key && (nc(e), this.key = t), n;
	}
});
//#endregion
//#region src/velair/views/schedule-view.ts
function ic(e, t, n, r) {
	return x`
    ${oc(e, t, n)}
    ${n && r ? sc(e, n, r) : x`<div class="notice">${e._t("noManagedEntities")}</div>`}
  `;
}
function ac(e, t, n) {
	return x`
    <section class="zones">
      ${t.map((t) => x`
          <button
            type="button"
            class=${[
		"zone",
		t === n ? "active" : "",
		t === e._dirtyEntityId ? "dirty" : ""
	].filter(Boolean).join(" ")}
            @click=${() => e._selectEntity(t)}
          >
            ${e._friendlyEntityName(t)}
          </button>
        `)}
    </section>
  `;
}
function oc(e, t, n) {
	return t.length ? x`
    <section class="schedule-zone-picker">
      <div class="schedule-step-heading">
        <strong>${e._t("scheduleStepClimate")}</strong>
      </div>
      ${ac(e, t, n)}
    </section>
  ` : C;
}
function sc(e, t, n) {
	let r = e._hasDraftValidationError("schedule");
	return x`
    <section class="schedule">
      <div class="schedule-editor-heading">
        <div>
          <strong>${e._t("scheduleStepDay")}</strong>
        </div>
        <div class="schedule-editor-badges">
          ${e._dirty && e._dirtyEntityId === t ? x`<span class="pill warning">${e._t("unsaved")}</span>` : C}
        </div>
      </div>
      ${cc(e, t, n)}
      <div class="day-tabs">
        ${e._orderedWeekdays().map((t) => lc(e, t, n.schedule[t] ?? []))}
      </div>
      <div class="schedule-step-heading">
        <strong>${e._t("scheduleStepConfigure")}</strong>
      </div>
      <div class="editor">
        ${uc(e, t, "schedule")}
        <div class="schedule-config-helper">${e._t("templateOptionalHint")}</div>
        <div class="schedule-config-row">
          ${pc(e)}
        </div>
        <div class="draft-list">
          ${e._draftBlocks.length ? x`
                ${mc(e, "schedule")}
                ${e._draftBlocks.map((n, r) => rc(Cc("schedule", t, e._selectedWeekday, r), gc(e, n, r, "schedule")))}
                ${hc(e, "schedule")}
              ` : hc(e, "schedule")}
        </div>
        <div class="schedule-save-actions">
          <button
            class="command-button primary"
            type="button"
            ?disabled=${e._templateAction === "save" || r}
            @click=${() => e._saveTemplate(!0)}
            title=${e._t("saveTemplate")}
          >
            <ha-icon icon="mdi:content-save-plus"></ha-icon>
            <span>${e._t("saveTemplate")}</span>
          </button>
          <button
            class="command-button primary"
            type="button"
            ?disabled=${e._saving || !e._dirty || r}
            @click=${e._saveSelectedDay}
          >
            <ha-icon icon="mdi:content-save"></ha-icon>
            <span>${e._t(e._saving ? "saving" : "save")}</span>
          </button>
        </div>
        <div class="schedule-copy-helper">${e._t("scheduleCopyHint")}</div>
        ${Tc(e)}
        ${Dc(e)}
      </div>
    </section>
  `;
}
function cc(e, t, n) {
	let r = n.override ?? e._data?.active_overrides?.[t];
	if (!zn(r)) return C;
	let i = Number(r.temperature), a = N(r.until), o = typeof r.hvac_mode == "string" ? r.hvac_mode : "";
	return x`
    <div class="boost-status">
      <ha-icon icon="mdi:lightning-bolt"></ha-icon>
      <div>
        <strong>${e._t("boostActive")}</strong>
        <span>
          ${Number.isFinite(i) ? x`${e._t("boostTarget")}: ${e._formatTemperature(i, t)}` : C}
          ${o ? x` - ${e._modeLabel(o)}` : C}
          ${a ? x` - ${e._t("boostUntil")}: ${e._formatRemaining(Math.max(0, a - Date.now()))}` : C}
        </span>
      </div>
    </div>
  `;
}
function lc(e, t, n) {
	return x`
    <button
      type="button"
      class=${t === e._selectedWeekday ? "day-tab active" : "day-tab"}
      @click=${() => e._selectWeekday(t)}
    >
      <span>${e._weekdayName(t).slice(0, 3)}</span>
      <strong>${n.length}</strong>
    </button>
  `;
}
function uc(e, t, n = "schedule") {
	let r = e._timelineBlocks(n);
	return x`
    <div class="timeline-panel">
      <div class="timeline-header">
        <span class="label">${e._t("timeline")}</span>
        <div class="timeline-hours">
          <span>00</span>
          <span>06</span>
          <span>12</span>
          <span>18</span>
          <span>24</span>
          ${dc(e)}
        </div>
      </div>
      <div
        class="timeline-track"
        @dragover=${e._handleTimelineDragOver}
        @drop=${(t) => e._handleTimelineDrop(t, n)}
      >
        ${r.length ? r.map((r) => fc(e, r, t, n)) : x`<span class="empty timeline-empty">${e._t("noBlocks")}</span>`}
      </div>
    </div>
  `;
}
function dc(e) {
	let t = Hn(e._currentTimelineNow());
	return x`
    <div
      class="timeline-now-marker"
      style=${`--timeline-now-left: ${t.left}%;`}
      title=${e._t("currentTime", { time: t.label })}
      aria-label=${e._t("currentTime", { time: t.label })}
    >
      <span>${t.label}</span>
    </div>
  `;
}
function fc(e, t, n, r = "schedule") {
	let i = t.draft.action === Je, a = Number(t.draft.temperature), o = i ? e._t("off") : Number.isFinite(a) ? e._formatTemperature(a, n) : e._t("invalidTemperatureRange"), s = e._formatScheduleTime(t.draft.start), c = i ? "" : t.draft.hvac_mode || e._t("keep"), l = Sc(e, t.draft), u = l.map((e) => e.short).join(" • "), d = [
		`${s} - ${o}`,
		c ? `${e._t("mode")}: ${c}` : "",
		...l.map((e) => `${e.label}: ${e.value}`)
	].filter(Boolean).join("\n");
	return x`
    <div
      class=${[
		"timeline-block",
		i ? "off" : "",
		`mode-${Zn(t.draft)}`,
		t.width < 5 ? "compact" : "",
		t.width < 2.5 ? "tiny" : ""
	].filter(Boolean).join(" ")}
      draggable="true"
      role="button"
      style=${`left: ${t.left}%; width: ${t.width}%;`}
      tabindex="0"
      title=${d}
      @dragstart=${(n) => e._handleTimelineDragStart(t.index, r, n)}
      @dragend=${e._handleTimelineDragEnd}
    >
      <div
        class="timeline-resize-handle left"
        title=${e._t("resizeStart")}
        draggable="false"
        @pointerdown=${(n) => e._handleTimelineResizeStart(t.index, "start", r, n)}
        @dragstart=${(e) => e.preventDefault()}
      ></div>
      <strong>${s}</strong>
      <span>${o}</span>
      ${c || u ? x`<small>${[c, u].filter(Boolean).join(" • ")}</small>` : C}
      ${t.nextIndex === void 0 ? C : x`
            <div
              class="timeline-resize-handle right"
              title=${e._t("resizeEnd")}
              draggable="false"
              @pointerdown=${(n) => e._handleTimelineResizeStart(t.index, "end", r, n)}
              @dragstart=${(e) => e.preventDefault()}
            ></div>
          `}
    </div>
  `;
}
function pc(e) {
	let t = e._scheduleTemplates();
	return x`
    <div class="template-panel">
      <div>
        <span class="label">${e._t("templates")}</span>
        <span class="select-wrap">
          <select
            .value=${e._selectedTemplateKey}
            ?disabled=${!t.length}
            @change=${(t) => {
		let n = t.currentTarget;
		e._selectScheduleTemplate(e._inputValue(t)), n.value = e._selectedTemplateKey;
	}}
          >
            ${t.length ? x`
                  <option value="">${e._t("selectTemplatePlaceholder")}</option>
                  ${t.map((t) => x`<option value=${t.key}>${e._templateLabel(t)}</option>`)}
                ` : x`<option value="">${e._t("noTemplates")}</option>`}
          </select>
        </span>
      </div>
    </div>
  `;
}
function mc(e, t = "schedule") {
	let n = e._temperatureUnit?.(t === "schedule" ? e._selectedEntity : void 0) ?? "°C";
	return x`
    <div class="draft-list-header" aria-hidden="true">
      <span>${e._t("time")}</span>
      <span>${e._t("mode")}</span>
      <span>${e._t("temp")} (${n})</span>
      <span></span>
      <span></span>
    </div>
  `;
}
function hc(e, t = "schedule") {
	return x`
    <div class="draft-add-row">
      <button
        class="icon-button success draft-add-button"
        type="button"
        @click=${() => e._addBlock(t)}
        title=${e._t("addBlock")}
        aria-label=${e._t("addBlock")}
      >
        <ha-icon icon="mdi:plus"></ha-icon>
      </button>
    </div>
  `;
}
function gc(e, t, n, r = "schedule") {
	let i = (t.action || "set_temperature") === Je, a = i ? "off" : t.hvac_mode ?? "", o = e._temperatureError(t, r), [s, c] = e._temperatureLimits(r), l = e._temperatureStep(r), u = _t(s, l), d = e._temperatureUnit?.(r === "schedule" ? e._selectedEntity : void 0) ?? "°C", f = e._hvacModeOptions(r), p = a && !f.includes(a) ? [...f, a] : f, ee = e._fanModeOptions(r), te = e._presetModeOptions(r), ne = e._swingModeOptions(r), re = e._swingHorizontalModeOptions(r), ie = e._humidityLimits(r), ae = !i && (ee.length > 0 || te.length > 0 || ne.length > 0 || re.length > 0 || !!ie), m = Sc(e, t), h = m.length > 0, oe = ae || h, g = h ? m.map((e) => e.short).join(" • ") : e._t("climateOptionsAdd");
	return x`
    <div class=${o ? "editable-block invalid" : "editable-block"}>
      <label>
        <span class="label">${e._t("start")}</span>
        <input
          type="time"
          .value=${t.start}
          @input=${(t) => e._updateDraftBlock(n, "start", e._inputValue(t), r)}
        />
      </label>
      <label>
        <span class="label">${e._t("mode")}</span>
        <span class="select-wrap">
          ${rc(wc(r, n, a, p), x`
              <select
                value=${a}
                .value=${a}
                @change=${(t) => e._updateDraftBlock(n, "hvac_mode", e._inputValue(t), r)}
                @input=${(t) => e._updateDraftBlock(n, "hvac_mode", e._inputValue(t), r)}
              >
                <option value="" .selected=${a === ""}>${e._t("keep")}</option>
                ${p.map((t) => x`
                  <option value=${t} .selected=${t === a}>${e._modeLabel(t)}</option>
                `)}
              </select>
            `)}
        </span>
      </label>
      <label>
        <span class="label">${e._t("temp")} (${d})</span>
        <input
          class=${o ? "invalid" : ""}
          type="number"
          min=${String(u)}
          max=${String(c)}
          step=${l === void 0 ? "any" : String(l)}
          ?disabled=${i}
          placeholder=${i ? e._t("off") : ""}
          .value=${i ? "" : String(t.temperature)}
          @input=${(t) => e._updateDraftBlock(n, "temperature", e._inputValue(t), r)}
          @change=${(t) => e._updateDraftBlock(n, "temperature", e._inputValue(t), r)}
        />
        ${o ? x`<small class="field-error">${o}</small>` : C}
      </label>
      ${oe ? x`
            <details class="advanced-climate-options" @toggle=${yc}>
              <summary
                class="icon-button climate-options-toggle"
                title=${m.map((e) => `${e.label}: ${e.value}`).join("\n") || e._t("climateOptions")}
                aria-label=${e._t("climateOptions")}
                @click=${_c}
              >
                <ha-icon icon="mdi:tune-variant"></ha-icon>
                ${h ? x`<span class="climate-options-badge">${m.length}</span>` : C}
              </summary>
              <button
                class="climate-options-scrim"
                type="button"
                aria-label=${e._t("dismiss")}
                @click=${vc}
              ></button>
              <fieldset class="advanced-climate-options-fields">
                <legend>${e._t("climateOptions")}</legend>
                ${xc(e, t, n, r, "fan_mode", "fanMode", ee)}
                ${xc(e, t, n, r, "preset_mode", "presetMode", te)}
                ${xc(e, t, n, r, "swing_mode", "swingMode", ne)}
                ${xc(e, t, n, r, "swing_horizontal_mode", "horizontalSwingMode", re)}
                ${ie || String(t.humidity ?? "").trim() ? x`
                      <label>
                        <span class="label">${e._t("targetHumidity")}</span>
                        <input
                          type="number"
                          min=${String(ie?.[0] ?? 0)}
                          max=${String(ie?.[1] ?? 100)}
                          step="1"
                          placeholder=${e._t("notSet")}
                          .value=${String(t.humidity ?? "")}
                          @input=${(t) => e._updateDraftBlock(n, "humidity", e._inputValue(t), r)}
                          @change=${(t) => e._updateDraftBlock(n, "humidity", e._inputValue(t), r)}
                        />
                      </label>
                    ` : C}
              </fieldset>
            </details>
          ` : x`<span class="advanced-climate-options-placeholder" aria-hidden="true"></span>`}
      <button
        class="icon-button danger"
        type="button"
        @click=${() => e._removeBlock(n, r)}
        title=${e._t("deleteBlock")}
      >
        <ha-icon icon="mdi:trash-can"></ha-icon>
      </button>
      ${h ? x`
            <small
              class="climate-options-inline-summary"
              title=${m.map((e) => `${e.label}: ${e.value}`).join("\n")}
            >
              ${g}
            </small>
          ` : C}
    </div>
  `;
}
function _c(e) {
	let t = e.currentTarget;
	if (!(t instanceof HTMLElement)) return;
	let n = t.closest("details"), r = t.getRootNode();
	(r instanceof Document || r instanceof ShadowRoot) && r.querySelectorAll(".advanced-climate-options[open]").forEach((e) => {
		e !== n && (e.open = !1);
	});
}
function vc(e) {
	e.preventDefault();
	let t = e.currentTarget;
	if (!(t instanceof HTMLElement)) return;
	let n = t.closest("details");
	n instanceof HTMLDetailsElement && (n.open = !1);
}
function yc(e) {
	let t = e.currentTarget;
	if (!(t instanceof HTMLDetailsElement) || !t.open) return;
	let n = t.querySelector("summary");
	n instanceof HTMLElement && bc(n, t);
}
function bc(e, t) {
	let n = e.getBoundingClientRect(), r = window.innerWidth || document.documentElement.clientWidth || 0, i = window.innerHeight || document.documentElement.clientHeight || 0, a = Math.max(280, Math.min(420, r - 32)), o = n.left + n.width / 2 - a / 2, s = Math.max(16, Math.min(o, r - a - 16)), c = Math.max(0, i - n.bottom - 8 - 16), l = Math.max(0, n.top - 8 - 16), u = l > c && c < 260, d = Math.max(180, u ? l : c), f = u ? n.top - 8 : n.bottom + 8;
	t.style.setProperty("--climate-options-left", `${Math.round(s)}px`), t.style.setProperty("--climate-options-top", `${Math.round(f)}px`), t.style.setProperty("--climate-options-width", `${Math.round(a)}px`), t.style.setProperty("--climate-options-max-height", `${Math.round(d)}px`), t.style.setProperty("--climate-options-translate-y", u ? "-100%" : "0");
}
function xc(e, t, n, r, i, a, o) {
	let s = String(t[i] ?? ""), c = s && !o.includes(s) ? [...o, s] : o;
	return !c.length && !s ? C : x`
    <label>
      <span class="label">${e._t(a)}</span>
      <span class="select-wrap">
        <select
          .value=${s}
          @change=${(t) => e._updateDraftBlock(n, i, e._inputValue(t), r)}
          @input=${(t) => e._updateDraftBlock(n, i, e._inputValue(t), r)}
        >
          <option value="" .selected=${s === ""}>${e._t("notSet")}</option>
          ${c.map((e) => x`
            <option value=${e} .selected=${e === s}>${e}</option>
          `)}
        </select>
      </span>
    </label>
  `;
}
function Sc(e, t) {
	let n = [], r = (t, r) => {
		if (typeof r != "string" || !r.trim()) return;
		let i = e._t(t);
		n.push({
			label: i,
			short: `${i}: ${r}`,
			value: r
		});
	};
	if (r("fanMode", t.fan_mode), r("presetMode", t.preset_mode), r("swingMode", t.swing_mode), r("horizontalSwingMode", t.swing_horizontal_mode), String(t.humidity ?? "").trim()) {
		let r = e._t("targetHumidity"), i = `${t.humidity}%`;
		n.push({
			label: r,
			short: `${r}: ${i}`,
			value: i
		});
	}
	return n;
}
function Cc(e, t, n, r) {
	return [
		e,
		t ?? "",
		n ?? "",
		r
	].join(":");
}
function wc(e, t, n, r) {
	return [
		e,
		t,
		n,
		r.join(",")
	].join(":");
}
function Tc(e) {
	let t = e._orderedWeekdays();
	return x`
    <div class="copy-panel">
      <div class="copy-header">
        <div>
          <span class="label">${e._t("cloneDayToDays")}</span>
          <strong>${e._t("otherDays")}</strong>
        </div>
      </div>
      <div class="copy-targets">
        ${t.map((t) => Ec(e, t))}
      </div>
      <div class="copy-actions">
        <button
          class="command-button success"
          type="button"
          ?disabled=${e._copying || e._copyTargets.size === 0 || e._hasDraftValidationError()}
          @click=${e._copySelectedDay}
        >
          <ha-icon icon="mdi:content-copy"></ha-icon>
          <span>${e._t(e._copying ? "applying" : "cloneAction")}</span>
        </button>
      </div>
    </div>
  `;
}
function Ec(e, t) {
	return t === e._selectedWeekday ? x`
      <span class="check-target disabled" title=${e._weekdayName(t)}>
        <span>${e._shortWeekdayName(t)}</span>
      </span>
    ` : x`
    <label class="check-target" title=${e._weekdayName(t)}>
      <input
        type="checkbox"
        .checked=${e._copyTargets.has(t)}
        @change=${(n) => e._toggleCopyTarget(t, n.currentTarget.checked)}
      />
      <span>${e._shortWeekdayName(t)}</span>
    </label>
  `;
}
function Dc(e) {
	let t = e._visibleZoneIds(e._data?.configured_entities ?? []).filter((t) => t !== e._selectedEntity);
	return t.length ? x`
    <div class="copy-panel">
      <div class="copy-header">
        <div>
          <span class="label">${e._t("cloneDayToThermostats")}</span>
          <strong>${e._t("otherThermostats")}</strong>
        </div>
      </div>
      <div class="copy-targets wide">
        ${t.map((t) => x`
            <label class="check-target">
              <input
                type="checkbox"
                .checked=${e._zoneTargets.has(t)}
                @change=${(n) => e._toggleZoneTarget(t, n.currentTarget.checked)}
              />
              <span>${e._friendlyEntityName(t)}</span>
            </label>
          `)}
      </div>
      <div class="copy-actions">
        <button
          class="command-button success"
          type="button"
          ?disabled=${e._applyingZones || e._zoneTargets.size === 0 || e._hasDraftValidationError()}
          @click=${e._applySelectedDayToZones}
        >
          <ha-icon icon="mdi:content-copy"></ha-icon>
          <span>${e._t(e._applyingZones ? "applying" : "cloneAction")}</span>
        </button>
      </div>
    </div>
  ` : C;
}
//#endregion
//#region src/velair/views/sensors-view.ts
var Oc = {
	climate: "var(--secondary-text-color)",
	climateTarget: "var(--primary-color)",
	room: "var(--success-color, #43a047)",
	target: "var(--error-color, #d93025)"
}, J = {
	target: 0,
	room: 1,
	climateTarget: 2,
	climate: 3
}, kc = 1.25, Ac = 22, Y = 10, jc = 20, Mc = {
	roomSensorAssist: "roomSensorAssistHelp",
	roomSensorAssistMaxDelta: "roomSensorAssistMaxDeltaHelp",
	roomSensorAssistDebounce: "roomSensorAssistDebounceHelp",
	roomSensorTemperatureEntity: "roomSensorTemperatureEntityHelp"
}, Nc = {
	showAssistSwitch: !0,
	showDebounce: !0,
	showLiveStatus: !0,
	showMaxDelta: !0,
	showRoomSensor: !0
};
function Pc(e, t, n = {}) {
	let r = Fc(n);
	return x`
    <section class="sensors-view">
      <header class="sensors-intro">
        <ha-icon icon="mdi:home-thermometer-outline"></ha-icon>
        <span>
          <strong>${e._t("roomSensorIntroTitle")}</strong>
          <small>${e._t("roomSensorIntroDetail")}</small>
        </span>
      </header>
      ${t.length ? t.map((t) => Ic(e, t, r)) : x`<span class="empty">${e._t("noManagedEntities")}</span>`}
    </section>
  `;
}
function Fc(e) {
	return {
		...Nc,
		...e
	};
}
function Ic(e, t, n) {
	let r = e._entityExists(t), i = ks(e._data?.zones[t]?.preconditioning, e._temperatureUnit(t)), a = e._data?.room_sensor_assist?.[t], o = r && e._expandedPreconditioningZones.has(t), s = `sensor-zone-content-${t.replace(/[^a-zA-Z0-9_-]/g, "-")}`, c = r ? e._t(o ? "roomSensorCollapseClimate" : "roomSensorExpandClimate", { climate: e._friendlyEntityName(t) }) : e._t("roomSensorUnavailable"), l = r && !!i.room_temperature_entity_id;
	return x`
    <section class=${`sensor-zone ${i.room_sensor_assist_enabled ? "enabled" : "disabled"} ${o ? "expanded" : "collapsed"}`}>
      <header class="sensor-zone-heading" @click=${(n) => {
		let r = n.target;
		r instanceof Element && r.closest(".sensor-zone-actions") || e._togglePreconditioningZone(t);
	}}>
        <button
          type="button"
          class="sensor-zone-toggle"
          title=${c}
          aria-label=${c}
          aria-expanded=${String(o)}
          aria-controls=${o ? s : C}
          ?disabled=${!r}
          @click=${(n) => {
		n.preventDefault(), n.stopPropagation(), e._togglePreconditioningZone(t);
	}}
        >
          <ha-icon
            class="sensor-expand-icon"
            icon=${o ? "mdi:chevron-down" : "mdi:chevron-right"}
          ></ha-icon>
          <span class="sensor-zone-identity">
            <strong title=${e._friendlyEntityName(t)}>
              ${e._friendlyEntityName(t)}
            </strong>
            <span>${t}</span>
          </span>
        </button>
        ${n.showAssistSwitch ? x`
              <div class="sensor-zone-actions" @click=${(e) => e.stopPropagation()}>
                <span
                  class=${l ? "sensor-enable-control" : "sensor-enable-control unavailable"}
                  title=${l ? "" : e._t("roomSensorNotConfigured")}
                >
                  <ha-switch
                    .checked=${i.room_sensor_assist_enabled}
                    ?disabled=${e._settingsSaving || !l}
                    @change=${(n) => e._saveZonePreconditioning(t, { room_sensor_assist_enabled: !!n.target.checked })}
                  ></ha-switch>
                </span>
              </div>
            ` : C}
      </header>
      ${r && o ? x`
            <div id=${s} class="sensor-zone-content">
              ${Lc(e, t, i, n)}
              ${n.showLiveStatus && i.room_temperature_entity_id && !i.room_sensor_assist_enabled ? Rc(e) : C}
              ${n.showLiveStatus && i.room_temperature_entity_id && i.room_sensor_assist_enabled ? zc(e, t, a) : C}
            </div>
          ` : C}
    </section>
  `;
}
function Lc(e, t, n, r) {
	return !r.showRoomSensor && !r.showMaxDelta && !r.showDebounce ? C : x`
    <section class="sensor-config-section">
      <h3><ha-icon icon="mdi:tune-variant"></ha-icon>${e._t("roomSensorAssist")}</h3>
      <div class="sensor-config-rows">
        ${r.showRoomSensor ? el(e, t, n.room_temperature_entity_id ?? "") : C}
        ${r.showMaxDelta ? tl(e, t, "roomSensorAssistMaxDelta", "room_sensor_assist_max_delta", n.room_sensor_assist_max_delta, rl(e._temperatureUnit(t)), nl(e._temperatureUnit(t)), rl(e._temperatureUnit(t)), e._temperatureUnit(t), { inactive: !n.room_temperature_entity_id || !n.room_sensor_assist_enabled }) : C}
        ${r.showDebounce ? tl(e, t, "roomSensorAssistDebounce", "room_sensor_assist_debounce_seconds", n.room_sensor_assist_debounce_seconds, 0, 300, 1, e._t("secondsShort"), { inactive: !n.room_temperature_entity_id || !n.room_sensor_assist_enabled }) : C}
      </div>
    </section>
  `;
}
function Rc(e) {
	return x`
    <section class="sensor-runtime-section sensor-inactive-section">
      <h3>
        <ha-icon icon="mdi:power-standby"></ha-icon>
        ${e._t("roomSensorStatusDisabled")}
      </h3>
      <p>${e._t("roomSensorAssistDisabledDetail")}</p>
    </section>
  `;
}
function zc(e, t, n) {
	if (!n) return C;
	let r = ll(e, t, n), i = typeof n.target_temperature == "number" && !!n.start;
	return x`
    <section class="sensor-runtime-section">
      <h3 class="sensor-runtime-heading">
        <span class="sensor-section-title">
          <ha-icon icon="mdi:pulse"></ha-icon>
          ${e._t("roomSensorLiveStatus")}
        </span>
        ${Bc(e, n)}
      </h3>
      <div class="sensor-status-card">
        ${i ? Hc(e, t, n) : Vc(e)}
        ${i && r.length ? Uc(e, t, r, n) : C}
      </div>
    </section>
  `;
}
function Bc(e, t) {
	let n = t?.status ?? "not_configured";
	return x`
    <span class=${`sensor-status-pill ${n}`}>
      ${e._t(ml(n))}
    </span>
  `;
}
function Vc(e) {
	return x`
    <div class="sensor-idle-state">
      <ha-icon icon="mdi:clock-outline"></ha-icon>
      <span>${e._t("roomSensorNoActiveBlockDetail")}</span>
    </div>
  `;
}
function Hc(e, t, n) {
	let r = n.start ? e._formatScheduleTime(n.start) : "", i = pl(e, n.active_from), a = !!(n.target_when && n.active_from), o = typeof n.target_temperature == "number" ? e._formatTemperature(n.target_temperature, t) : e._t("roomSensorValueUnavailable"), s = n.hvac_mode ? e._modeLabel(n.hvac_mode) : e._t("roomSensorValueUnavailable");
	return x`
    <div class="sensor-block-summary">
      ${a ? x`
            <span class="sensor-block-detail emphasis">
              <ha-icon icon="mdi:creation-outline"></ha-icon>
              ${e._t("roomSensorBlockStartedEarly", { time: i })}
            </span>
            <span class="sensor-block-detail">
              <ha-icon icon="mdi:calendar-clock"></ha-icon>
              ${e._t("roomSensorBlockScheduled", { time: r })}
            </span>
          ` : x`
            <span class="sensor-block-detail">
              <ha-icon icon="mdi:calendar-clock"></ha-icon>
              ${e._t("roomSensorBlockScheduled", { time: r })}
            </span>
            <span class="sensor-block-detail">
              <ha-icon icon="mdi:play-circle-outline"></ha-icon>
              ${e._t("roomSensorBlockActiveSince", { time: r })}
            </span>
          `}
      <span class="sensor-block-detail">
        <ha-icon icon="mdi:thermometer"></ha-icon>
        ${e._t("roomSensorBlockTarget", { target: o })}
      </span>
      <span class="sensor-block-detail">
        <ha-icon icon="mdi:hvac"></ha-icon>
        ${e._t("roomSensorBlockMode", { mode: s })}
      </span>
    </div>
  `;
}
function Uc(e, t, n, r) {
	let i = [...n].sort((e, t) => e.value - t.value), a = r.hvac_mode ? `mode-${mt(r.hvac_mode)}` : "mode-keep", o = al(e, t, n), s = ol(e, t, n, r), c = Wc(n);
	return x`
    <div class=${`sensor-temperature-scale ${a}`}>
      <div
        class="sensor-scale-track"
        role="group"
        aria-label=${e._t("roomSensorTemperatureScale")}
      >
        <span class="sensor-scale-line"></span>
        ${o ? x`
              <span
                class=${`sensor-scale-relation sensor-scale-room-gap room-gap-${o.position}`}
                style=${[`left: ${o.left.toFixed(2)}%;`, `width: ${o.width.toFixed(2)}%;`].join(" ")}
                title=${o.label}
                role="note"
                aria-label=${o.label}
              >
                <span>${o.label}</span>
              </span>
            ` : C}
        ${s ? x`
              <span
                class=${`sensor-scale-relation sensor-scale-assist-offset assist-offset-${s.state}`}
                style=${[`left: ${s.left.toFixed(2)}%;`, `width: ${s.width.toFixed(2)}%;`].join(" ")}
                title=${s.title}
                role="note"
                aria-label=${`${s.label}. ${s.title}`}
              >
                <span>${s.label}</span>
              </span>
            ` : C}
        ${c.map((e) => x`
            <span
              class=${Kc(e)}
              style=${qc(e)}
              role="img"
              aria-label=${Xc(e)}
            >
              <span class=${`sensor-scale-dot ${e.markers.length > 1 ? "segmented" : ""}`}></span>
            </span>
          `)}
        ${n.map((n) => x`
            <span
              class=${`sensor-scale-callout-marker marker-${n.key} lane-${n.lane} ${Zc(n)} ${n.shifted ? "shifted" : ""}`}
              style=${`--callout-left: ${n.calloutPosition.toFixed(2)}%;`}
            >
              ${Qc(e, t, n, r)}
            </span>
          `)}
      </div>
      <div class="sensor-scale-bounds">
        <span>${il(e, t, i[0]?.value)}</span>
        <span>${il(e, t, i[i.length - 1]?.value)}</span>
      </div>
    </div>
  `;
}
function Wc(e) {
	let t = [...e].sort((e, t) => e.position - t.position || J[e.key] - J[t.key]), n = [];
	for (let e of t) {
		let t = n[n.length - 1];
		if (t && Math.abs(e.position - t.position) <= kc) {
			t.markers = [...t.markers, e].sort((e, t) => J[e.key] - J[t.key]), t.position = Gc(t.markers);
			continue;
		}
		n.push({
			markers: [e],
			position: e.position
		});
	}
	return n;
}
function Gc(e) {
	return e.reduce((e, t) => e + t.position, 0) / e.length;
}
function Kc(e) {
	return [
		"sensor-scale-marker",
		`count-${e.markers.length}`,
		...e.markers.map((e) => `marker-${e.key}`)
	].join(" ");
}
function qc(e) {
	let t = [`left: ${e.position.toFixed(2)}%;`];
	return e.markers.length > 1 && t.push(`--sensor-scale-dot-segments: ${Jc(e.markers)};`), t.join(" ");
}
function Jc(e) {
	let t = [...e].sort((e, t) => t.calloutPosition - e.calloutPosition || e.lane - t.lane || J[e.key] - J[t.key]), n = 360 / t.length;
	return `conic-gradient(${t.map((e, t) => {
		let r = Yc(t * n), i = Yc((t + 1) * n);
		return `${Oc[e.key]} ${r}deg ${i}deg`;
	}).join(", ")})`;
}
function Yc(e) {
	return Math.round(e * 100) / 100;
}
function Xc(e) {
	return e.markers.map((e) => `${e.label}: ${e.formatted}`).join(", ");
}
function Zc(e) {
	return e.calloutPosition <= Y ? "edge-left" : e.calloutPosition >= 100 - Y ? "edge-right" : "";
}
function Qc(e, t, n, r) {
	let i = n.key === "climateTarget" && typeof r.assist_delta == "number" ? Go(r.assist_delta, r.direction) : null, a = typeof i == "number" ? cl(e, t, i) : "", o = e._t("roomSensorAssistOffsetHelp");
	return x`
    <span class="sensor-scale-callout">
      <small>${n.label}</small>
      <span class="sensor-scale-value-row">
        <strong>${n.formatted}</strong>
        ${a ? x`
              <span class="sensor-scale-offset">
                <span>${a}</span>
                <span
                  class="sensor-scale-offset-help"
                  tabindex="0"
                  aria-label=${o}
                  @click=${(e) => {
		e.preventDefault(), e.stopPropagation();
	}}
                >
                  <ha-icon icon="mdi:information-outline"></ha-icon>
                  <span class="sensor-scale-offset-tooltip" role="tooltip">
                    ${o}
                  </span>
                </span>
              </span>
            ` : C}
      </span>
    </span>
  `;
}
function $c(e, t) {
	let n = Mc[t], r = n ? e._t(n) : "";
	return x`
    <span class="label sensor-config-label">
      <span>${e._t(t)}</span>
      ${n ? x`
            <span
              class="sensor-help"
              tabindex="0"
              aria-label=${r}
              @click=${(e) => {
		e.preventDefault(), e.stopPropagation();
	}}
            >
              <ha-icon icon="mdi:information-outline"></ha-icon>
              <span class="sensor-help-tooltip" role="tooltip">${r}</span>
            </span>
          ` : C}
    </span>
  `;
}
function el(e, t, n) {
	let r = e._settingsSaving, i = Os(e.hass, n);
	return x`
    <label class="sensor-config-row sensor-picker-row">
      ${$c(e, "roomSensorTemperatureEntity")}
      <span class="select-wrap">
        <select
          .value=${n}
          value=${n}
          ?disabled=${r}
          @change=${(n) => {
		let r = n.currentTarget.value.trim();
		e._saveZonePreconditioning(t, r ? { room_temperature_entity_id: r } : {
			room_temperature_entity_id: null,
			room_sensor_assist_enabled: !1
		});
	}}
        >
          <option value="" ?selected=${n === ""}>
            ${e._t("roomSensorSelectSensor")}
          </option>
          ${i.map((e) => x`
              <option value=${e.entityId} ?selected=${e.entityId === n}>
                ${e.label} · ${e.entityId}
              </option>
            `)}
        </select>
        ${n ? x`<small class="sensor-selected-entity">${n}</small>` : C}
      </span>
    </label>
  `;
}
function tl(e, t, n, r, i, a, o, s, c, l = {}) {
	let u = e._settingsSaving || !!l.inactive;
	return x`
    <label class=${`sensor-config-row ${l.inactive ? "inactive" : ""}`}>
      ${$c(e, n)}
      <span class="sensor-number-input">
        <input
          type="number"
          min=${String(a)}
          max=${String(o)}
          step=${String(s)}
          .value=${String(i)}
          ?disabled=${u}
          @change=${(n) => {
		if (u) return;
		let s = Number(n.currentTarget.value), c = Math.min(o, Math.max(a, Number.isFinite(s) ? s : i));
		e._saveZonePreconditioning(t, { [r]: c });
	}}
        />
        <span>${c}</span>
      </span>
    </label>
  `;
}
function nl(e) {
	return kn(e, 10);
}
function rl(e) {
	return .1;
}
function il(e, t, n) {
	return typeof n == "number" ? e._formatTemperature(n, t) : e._t("roomSensorValueUnavailable");
}
function al(e, t, n) {
	let r = n.find((e) => e.key === "target"), i = n.find((e) => e.key === "room");
	if (!r || !i) return null;
	let a = Math.abs(r.value - i.value);
	if (a < (e._temperatureUnit(t).toUpperCase().includes("F") ? .1 : .05)) return null;
	let o = sl(e, t, a), s = i.value < r.value ? "below" : "above";
	return {
		label: e._t(s === "below" ? "roomSensorGapBelowTarget" : "roomSensorGapAboveTarget", { value: o }),
		left: Math.min(r.position, i.position),
		position: s,
		width: Math.abs(r.position - i.position)
	};
}
function ol(e, t, n, r) {
	let i = n.find((e) => e.key === "climate"), a = n.find((e) => e.key === "climateTarget");
	if (!i || !a || typeof r.assist_delta != "number") return null;
	let o = e._temperatureUnit(t).toUpperCase().includes("F") ? .1 : .05, s = typeof r.assist_delta == "number" ? Go(r.assist_delta, r.direction) : null, c = typeof s == "number" ? typeof s == "number" && Math.abs(s) >= o ? "active" : "holding" : "unknown", l = typeof s == "number" ? cl(e, t, s) : "";
	return {
		label: c === "active" ? e._t("roomSensorAssistCorrectionValue", { value: l }) : e._t("roomSensorAssistNoCorrection"),
		left: Math.min(i.position, a.position),
		state: c,
		title: c === "active" ? e._t("roomSensorAssistCorrectionActiveHelp") : e._t("roomSensorAssistNoCorrectionHelp"),
		width: Math.abs(i.position - a.position)
	};
}
function sl(e, t, n) {
	return e._formatTemperature(Math.abs(n), t);
}
function cl(e, t, n) {
	let r = sl(e, t, n);
	return n > 0 ? `+${r}` : n < 0 ? `-${r}` : r;
}
function ll(e, t, n) {
	let r = n.status === "assisting" || n.status === "holding" ? n.applied_temperature ?? n.climate_target_temperature : n.climate_target_temperature ?? n.applied_temperature, i = [
		{
			key: "target",
			label: e._t("roomSensorScheduledTarget"),
			value: n.target_temperature
		},
		{
			key: "room",
			label: e._t("roomSensorRoomTemperature"),
			value: n.room_temperature
		},
		{
			key: "climateTarget",
			label: e._t("roomSensorClimateTarget"),
			value: r
		},
		{
			key: "climate",
			label: e._t("roomSensorClimateTemperature"),
			value: n.climate_temperature
		}
	].filter((e) => typeof e.value == "number");
	if (!i.length) return [];
	let a = i.map((e) => e.value), o = Math.min(...a), s = Math.max(...a), c = e._temperatureUnit(t).toUpperCase().includes("F") ? 2 : 1, l = s - o, u = Math.max(l, c), d = (o + s) / 2, f = d - u * .58, p = d + u * .58 - f;
	return ul(i.map((n) => ({
		...n,
		calloutPosition: 0,
		formatted: e._formatTemperature(n.value, t),
		lane: 0,
		position: Math.max(0, Math.min(100, (n.value - f) / p * 100)),
		shifted: !1
	})));
}
function ul(e) {
	let t = [...e].sort((e, t) => e.position - t.position), n = /* @__PURE__ */ new Map(), r = [], i = () => {
		if (!r.length) return;
		let e = r.reduce((e, t) => e + t.position, 0) / r.length, t = dl(r.length, e);
		r.forEach((e, r) => {
			let i = t[r] ?? e.position;
			n.set(e.key, {
				calloutPosition: i,
				lane: r,
				shifted: Math.abs(i - e.position) > .5
			});
		}), r = [];
	};
	for (let e of t) {
		let t = r[r.length - 1];
		t && e.position - t.position > Ac && i(), r.push(e);
	}
	return i(), e.map((e) => ({
		...e,
		...n.get(e.key) ?? {
			calloutPosition: e.position,
			lane: 0,
			shifted: !1
		}
	}));
}
function dl(e, t) {
	if (e <= 1) return [fl(t, Y, 100 - Y)];
	let n = (e - 1) * jc, r = t - n / 2, i = Y, a = 100 - Y;
	return r < i ? r = i : r + n > a && (r = a - n), Array.from({ length: e }, (e, t) => fl(r + t * jc, i, a));
}
function fl(e, t, n) {
	return Math.min(n, Math.max(t, e));
}
function pl(e, t) {
	if (!t) return "";
	let n = new Date(t);
	if (Number.isNaN(n.getTime())) return t;
	let r = `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
	return e._formatScheduleTime(r);
}
function ml(e) {
	return {
		assisting: "roomSensorStatusAssisting",
		blocked: "roomSensorStatusBlocked",
		disabled: "roomSensorStatusDisabled",
		holding: "roomSensorStatusHolding",
		idle: "roomSensorStatusIdle",
		not_configured: "roomSensorStatusNotConfigured",
		ready: "roomSensorStatusReady",
		unavailable: "roomSensorStatusUnavailable"
	}[e];
}
//#endregion
//#region src/velair/views/settings-view.ts
function hl(e, t) {
	let n = e._firstWeekday(), r = !!e._data?.settings?.apply_active_schedule_on_startup;
	return x`
    <section class="settings-view">
      ${gl(e)}

      <label class="settings-field">
        <span class="label">${e._t("firstWeekday")}</span>
        <span class="select-wrap">
          <select
            .value=${n}
            value=${n}
            @change=${(t) => e._updateSettingsFirstWeekday(e._inputValue(t))}
          >
            ${k.map((t) => x`
                <option value=${t} ?selected=${t === n}>
                  ${e._weekdayName(t)}
                </option>
              `)}
          </select>
        </span>
      </label>

      <section class="settings-startup">
        <ha-icon class="settings-startup-icon" icon="mdi:home-clock"></ha-icon>
        <div class="settings-startup-copy">
          <span class="section-label">${e._t("applyScheduleOnStartup")}</span>
          <p>${e._t("applyScheduleOnStartupDescription")}</p>
        </div>
        <ha-switch
          .checked=${r}
          ?disabled=${e._settingsSaving}
          @change=${(t) => e._saveSettings({ apply_active_schedule_on_startup: !!t.target.checked })}
        ></ha-switch>
      </section>

      ${yl(e)}

      <section class="settings-zone-order">
        <div class="section-heading">
          <ha-icon icon="mdi:sort"></ha-icon>
          <div>
            <span class="section-label">${e._t("zoneOrder")}</span>
            <p>${e._t("reorderZones")}</p>
          </div>
        </div>
        <div class="settings-zone-list">
          ${t.length ? t.map((n, r) => xl(e, n, r, t.length)) : x`<span class="empty">${e._t("noManagedEntities")}</span>`}
        </div>
      </section>

      ${_l(e)}
    </section>
  `;
}
function gl(e) {
	let t = !!e._data?.temperature_migration?.required, n = e._data?.home_assistant_temperature_unit ?? e._temperatureUnit(), r = e._data?.temperature_migration, i = r?.reason === "legacy_celsius_upgrade_reset_required", a = r?.source_unit, o = r?.target_unit ?? n;
	return x`
    <section class=${t ? "settings-temperature migration-required" : "settings-temperature"}>
      <ha-icon class="settings-startup-icon" icon="mdi:thermometer-lines"></ha-icon>
      <div class="settings-temperature-copy">
        <span class="section-label">${e._t("temperatureUnit")}</span>
        <p>${e._t("temperatureUnitManagedByHomeAssistant")}</p>
        ${t ? x`
              <div class="temperature-migration-action" role="alert">
                <strong>${i ? e._t("temperatureLegacyResetQuestion", { target: o }) : e._t("temperatureMigrationQuestion", {
		source: a ?? "?",
		target: o
	})}</strong>
                <p>${i ? e._t("temperatureLegacyResetExplanation", { target: o }) : e._t("temperatureMigrationExplanation", {
		source: a ?? "?",
		target: o
	})}</p>
                <div class="temperature-migration-buttons">
                  ${i ? x`
                      <button
                        class="command-button danger"
                        type="button"
                        ?disabled=${e._maintenanceAction === "reset"}
                        @click=${() => e._resetVelairData()}
                      >
                        ${e._maintenanceAction === "reset" ? e._t("resetting") : e._t("resetVelair")}
                      </button>
                    ` : a ? x`
                      <button
                        class="command-button primary"
                        type="button"
                        ?disabled=${!!e._temperatureMigrationAction}
                        @click=${() => e._resolveTemperatureMigration(a)}
                      >
                        ${e._temperatureMigrationAction === a ? e._t("applying") : e._t("temperatureMigrationUse", {
		source: a,
		target: o
	})}
                      </button>
                    ` : C}
                </div>
              </div>
            ` : C}
      </div>
      <strong class="settings-temperature-value">${n}</strong>
    </section>
  `;
}
function _l(e) {
	let t = e._data?.versions ?? {}, r = t.portable_model ?? 3, i = t.storage ?? 1, a = t.model ?? 1, o = e._maintenanceAction === "reset", s = !!e._data?.temperature_migration?.required, c = e._data?.temperature_migration?.reason === "legacy_celsius_upgrade_reset_required";
	return x`
    <section class="settings-maintenance">
      <div class="settings-portability-heading">
        <ha-icon class="settings-startup-icon" icon="mdi:wrench-clock"></ha-icon>
        <div>
          <span class="section-label">${e._t("maintenance")}</span>
          <p>${e._t("maintenanceDescription")}</p>
        </div>
      </div>

      <div class="maintenance-grid">
        ${vl(e._t("frontendBuild"), n)}
        ${vl(e._t("portableFormatVersion"), `v${r}`)}
        ${vl(e._t("internalStorageVersion"), `v${i} / v${a}`)}
        ${vl(e._t("integrationVersion"), "1.2.0")}
      </div>
    </section>

    <section class="settings-reset">
      <ha-icon class="settings-reset-icon" icon="mdi:delete-alert-outline"></ha-icon>
      <div class="settings-reset-copy">
        <span class="section-label">${e._t("resetVelair")}</span>
        <p>${e._t("resetVelairDescription")}</p>
      </div>
      <button
        class="command-button danger"
        type="button"
        ?disabled=${o || s && !c}
        @click=${() => e._resetVelairData()}
      >
        <ha-icon icon="mdi:restore"></ha-icon>
        <span>${o ? e._t("resetting") : e._t("resetVelair")}</span>
      </button>
    </section>
  `;
}
function vl(e, t) {
	return x`
    <div class="maintenance-item">
      <span class="label">${e}</span>
      <strong>${t}</strong>
    </div>
  `;
}
function yl(e) {
	let t = e._importAvailableSections(), n = e._exportSections.size > 0 && !e._portabilityAction, r = !!e._importPayload && e._importSections.size > 0 && !e._portabilityAction, i = new Map(e._portableExportSummaryItems().map((e) => [e.section, e])), a = new Map(e._portableImportSummaryItems().map((e) => [e.section, e])), o = e._importSections.has("preconditioning_learning") ? Hr(e._importPayload, e._data?.configured_entities ?? []) : [], s = !!(e._importPayload && e._importPayload.temperature_unit === void 0);
	return x`
    <section class="settings-portability">
      <div class="settings-portability-heading">
        <ha-icon class="settings-startup-icon" icon="mdi:file-sync-outline"></ha-icon>
        <div>
          <span class="section-label">${e._t("portability")}</span>
          <p>${e._t("portabilityDescription")}</p>
        </div>
      </div>

      <div class="portability-grid">
        <div class="portability-card portability-export-card">
          <div class="portability-options">
            ${$e.map((t) => bl(e, "export", t, e._exportSections.has(t), !1, i.get(t)))}
          </div>
          <button
            class="command-button primary"
            type="button"
            ?disabled=${!n}
            @click=${() => e._exportPortableData()}
          >
            <ha-icon icon="mdi:download"></ha-icon>
            <span>${e._portabilityAction === "export" ? e._t("saving") : e._t("exportData")}</span>
          </button>
        </div>

        <div class="portability-card">
          <label class="portable-file-field">
            <span class="label">${e._t("importFile")}</span>
            <span class="portable-file-control">
              <input
                type="file"
                accept="application/json,.json"
                ?disabled=${!!e._portabilityAction}
                @change=${(t) => e._handlePortableImportFile(t)}
              />
              <span class="portable-file-button">${e._t("chooseFile")}</span>
              <span class="portable-file-name">${e._importFileName || e._t("noFileSelected")}</span>
            </span>
          </label>
          ${e._importFileName ? x`<span class="empty">${e._t("portabilityFileReady", { file: e._importFileName })}</span>` : C}
          ${e._importPayload ? x`
                <div class="portable-warning" role="alert">
                  <ha-icon icon="mdi:alert-outline"></ha-icon>
                  <span>${e._t("importOverwriteWarning")}</span>
                </div>
              ` : C}
          ${s ? x`
                <div class="portable-warning" role="status">
                  <ha-icon icon="mdi:thermometer-alert"></ha-icon>
                  <span>${e._t("legacyImportTemperatureUnit", { target: e._data?.home_assistant_temperature_unit ?? e._temperatureUnit() })}</span>
                </div>
              ` : C}
          ${o.length ? x`
                <div class="portable-warning" role="alert">
                  <ha-icon icon="mdi:thermometer-alert"></ha-icon>
                  <span>
                    ${e._t("preconditioningImportSkipped", {
		count: o.length,
		entities: o.join(", ")
	})}
                  </span>
                </div>
              ` : C}
          <div class="portability-options">
            ${t.length ? t.map((t) => bl(e, "import", t, e._importSections.has(t), !1, a.get(t))) : x`<span class="empty">${e._t("noImportSections")}</span>`}
          </div>
          <button
            class="command-button success"
            type="button"
            ?disabled=${!r}
            @click=${() => e._importPortableData()}
          >
            <ha-icon icon="mdi:upload"></ha-icon>
            <span>${e._portabilityAction === "import" ? e._t("applying") : e._t("importData")}</span>
          </button>
        </div>
      </div>
    </section>
  `;
}
function bl(e, t, n, r, i, a) {
	return x`
    <label class="portable-option" title=${a?.title ?? e._portableSectionLabel(n)}>
      <input
        type="checkbox"
        .checked=${r}
        ?disabled=${i || !!e._portabilityAction}
        @change=${(r) => e._togglePortableSection(t, n, !!r.currentTarget.checked)}
      />
      ${a && typeof a.value == "number" ? x`<strong>${a.value}</strong>` : C}
      <span>${a?.label ?? e._portableSectionLabel(n)}</span>
    </label>
  `;
}
function xl(e, t, n, r) {
	let i = e._entityExists(t), [a, o] = e._entityTemperatureLimits(t), s = e._entityTemperatureStep(t), c = e._climateSupportedModes(t), l = e._climateProvidedData(t), u = e._entityDiagnostic(t), d = e._data?.zones[t]?.preconditioning, f = !!d?.enabled, p = !!(d?.room_sensor_assist_enabled && d?.room_temperature_entity_id);
	return x`
    <div
      class="settings-zone-row"
      @dragover=${(t) => e._handleSettingsZoneDragOver(t)}
      @drop=${(n) => e._handleSettingsZoneDrop(t, n)}
      @dragend=${e._handleSettingsZoneDragEnd}
    >
      <button
        class="settings-drag-handle"
        type="button"
        title=${e._t("reorderZones")}
        aria-label=${e._t("reorderZones")}
        draggable="true"
        @dragstart=${(n) => e._handleSettingsZoneDragStart(t, n)}
        @dragend=${e._handleSettingsZoneDragEnd}
      >
        <ha-icon icon="mdi:drag"></ha-icon>
      </button>
      <div class="settings-zone-main">
        <div class="settings-zone-identity">
          <div class="settings-zone-title">
            <span
              class=${`settings-diagnostic-dot ${u.status}`}
              title=${u.tooltip}
              aria-label=${u.tooltip}
            ></span>
            <strong title=${e._friendlyEntityName(t)}>${e._friendlyEntityName(t)}</strong>
          </div>
          <span>${t}</span>
          ${f ? x`
                <span
                  class="settings-feature-badge preconditioning"
                  title=${e._t("preconditioningEnabled")}
                  aria-label=${e._t("preconditioningEnabled")}
                >
                  <ha-icon icon="mdi:clock-fast"></ha-icon>
                  ${e._t("preconditioning")}
                </span>
              ` : C}
          ${p ? x`
                <span
                  class="settings-feature-badge room-assist"
                  title=${e._t("roomSensorAssistEnabled")}
                  aria-label=${e._t("roomSensorAssistEnabled")}
                >
                  <ha-icon icon="mdi:home-thermometer-outline"></ha-icon>
                  ${e._t("roomSensorAssistBadge")}
                </span>
              ` : C}
          ${u.status === "ok" ? C : x`<span class=${`settings-diagnostic-text ${u.status}`}>${u.messages.join(" · ")}</span>`}
        </div>
        ${i ? x`
              <div class="settings-capability-section settings-capability-row">
                <span class="label">${e._t("availableModes")}</span>
                <div class="settings-mode-tags">
                  ${c.length ? c.map((t) => x`
                          <span class=${`mode-chip mode-${mt(t)}`}>
                            ${e._modeLabel(t)}
                          </span>
                        `) : x`<span class="empty">${e._t("keep")}</span>`}
                </div>
              </div>
              <div class="settings-capability-composite">
                <div class="settings-capability-section settings-capability-row">
                  <span class="label">${e._t("temperatureRange")}</span>
                  <div class="settings-facts">
                    <span title=${e._t("temperatureRange")}>
                      <ha-icon icon="mdi:thermometer-lines"></ha-icon>
                      ${e._formatTemperatureLimit(a)}-${e._formatTemperatureLimit(o)}
                      ${e._temperatureUnit(t)}
                    </span>
                    <span
                      class=${s === void 0 ? "capability-not-reported" : ""}
                      title=${s === void 0 ? e._t("temperatureStepNotReportedDescription") : e._t("temperatureStep")}
                    >
                      <ha-icon icon="mdi:delta"></ha-icon>
                      ${e._t("temperatureStep")}: ${s === void 0 ? e._t("temperatureStepNotReported") : e._formatTemperatureLimit(s)}
                    </span>
                  </div>
                </div>
                <div class="settings-capability-section settings-capability-row">
                  <span class="label">${e._t("providedData")}</span>
                  <div class="settings-data-icons">
                    ${l.map((e) => x`
                        <span title=${e.label} aria-label=${e.label}>
                          <ha-icon icon=${e.icon}></ha-icon>
                        </span>
                      `)}
                  </div>
                  ${l.length ? C : x`<span class="empty">${e._t("noUpcomingEvent")}</span>`}
                </div>
              </div>
            ` : C}
      </div>
      <div class="settings-row-actions">
        <button
          class="icon-button"
          type="button"
          title=${e._t("moveUp")}
          ?disabled=${n === 0}
          @click=${() => e._moveSettingsZone(t, -1)}
        >
          <ha-icon icon="mdi:chevron-up"></ha-icon>
        </button>
        <button
          class="icon-button"
          type="button"
          title=${e._t("moveDown")}
          ?disabled=${n === r - 1}
          @click=${() => e._moveSettingsZone(t, 1)}
        >
          <ha-icon icon="mdi:chevron-down"></ha-icon>
        </button>
      </div>
    </div>
  `;
}
//#endregion
//#region src/velair/views/templates-view.ts
function Sl(e, t) {
	let n = e._scheduleTemplates(), r = n.find((t) => t.key === e._selectedTemplateKey), i = e._hasDraftValidationError("template"), a = r ? e._templateNameInputValue(r) : "", o = r ? e._templateDraftBlocks : [];
	return n.length ? x`
    <section class="template-library">
      <div class="template-library-layout">
        <div class=${e._templateListClass(n.length)}>
          <div class="template-list-heading">
            <div class="section-heading">
              <ha-icon icon="mdi:content-copy"></ha-icon>
              <span class="section-label">${e._t("templates")} (${n.length})</span>
            </div>
            <button
              class="icon-button primary"
              type="button"
              ?disabled=${e._templateAction === "save"}
              @click=${() => e._createTemplate()}
              title=${e._t("createTemplate")}
            >
              <ha-icon icon="mdi:plus"></ha-icon>
            </button>
          </div>
          <div class="template-list" @scroll=${e._handleTemplateListScroll}>
            ${n.map((t) => x`
                <div class=${t.key === r?.key ? "template-item active" : "template-item"}>
                  <button
                    class="template-item-main"
                    type="button"
                    @click=${() => e._selectTemplate(t.key)}
                  >
                    <strong>${e._templateLabel(t)}</strong>
                    <span>${e._t("blocks")}: ${t.blocks.length}</span>
                  </button>
                  <button
                    class="icon-button danger template-item-delete"
                    type="button"
                    ?disabled=${e._templateAction === "delete"}
                    @click=${(n) => {
		n.stopPropagation(), e._selectTemplate(t.key), e._deleteSelectedTemplate();
	}}
                    title=${e._t("deleteTemplate")}
                  >
                    <ha-icon icon="mdi:trash-can"></ha-icon>
                  </button>
                </div>
              `)}
          </div>
        </div>
        <div class="template-detail">
          ${r ? x`
                <div class="template-detail-heading">
                  <label class="template-name-field">
                    ${e._templateDirty ? x`<span class="pill warning">${e._t("unsaved")}</span>` : C}
                    <div class="template-name-input-wrap">
                      <ha-icon icon="mdi:pencil"></ha-icon>
                      <input
                        aria-label=${e._t("customTemplateName")}
                        .value=${a}
                        @input=${(t) => e._updateTemplateNameDraft(r.key, e._inputValue(t))}
                      />
                    </div>
                  </label>
                  <div class="template-detail-actions">
                    <button
                      class="command-button success template-apply-button"
                      type="button"
                      ?disabled=${!r || i}
                      @click=${() => {
		e._selectTemplate(r.key), e._toggleTemplateApplyPanel();
	}}
                      title=${e._t("applyToAction")}
                    >
                      <ha-icon icon="mdi:calendar-check"></ha-icon>
                      <span>${e._t("applyToAction")}</span>
                    </button>
                    <button
                      class="icon-button primary"
                      type="button"
                      ?disabled=${e._templateAction === "save" || !a.trim() || i}
                      @click=${() => {
		e._saveSelectedTemplateFromLibrary(r);
	}}
                      title=${e._t("save")}
                    >
                      <ha-icon icon="mdi:content-save"></ha-icon>
                    </button>
                  </div>
                </div>
                ${Cl(e, r)}
                <div class="editor template-editor">
                  ${uc(e, t, "template")}
                  <div class="draft-list template-block-list">
                    ${o.length ? x`
                          ${mc(e, "template")}
                          ${o.map((t, n) => rc(Cc("template", r.key, void 0, n), gc(e, t, n, "template")))}
                          ${hc(e, "template")}
                        ` : hc(e, "template")}
                  </div>
                </div>
              ` : x`
                <div class="template-placeholder compact">
                  <span>${e._t("selectTemplateToBegin")}</span>
                </div>
              `}
        </div>
      </div>
    </section>
  ` : x`
      <section class="template-library">
        <div class="template-placeholder compact">
          <span>${e._t("noTemplates")}</span>
          <button
            class="icon-button primary"
            type="button"
            ?disabled=${e._templateAction === "save"}
            @click=${() => e._createTemplate()}
            title=${e._t("createTemplate")}
          >
            <ha-icon icon="mdi:plus"></ha-icon>
          </button>
        </div>
      </section>
    `;
}
function Cl(e, t) {
	if (!e._templateApplyOpen) return C;
	let n = e._visibleZoneIds(e._data?.configured_entities ?? []), r = e._orderedWeekdays(), i = e._hasDraftValidationError("template"), a = e._templateApplyTargets.size > 0;
	return x`
    <div class="template-apply-panel">
      <div class="copy-header">
        <div>
          <span class="label">${e._t("applyTemplateTo", { template: e._templateLabel(t) })}</span>
        </div>
        <button
          class="command-button success"
          type="button"
          ?disabled=${e._applyingTemplateTargets || !a || i}
          @click=${() => e._applyTemplateToTargets(t)}
        >
          <ha-icon icon="mdi:check-circle-outline"></ha-icon>
          <span>${e._t(e._applyingTemplateTargets ? "applying" : "apply")}</span>
        </button>
      </div>
      ${n.length ? x`
            <div class="template-apply-scroll-wrap">
              <div class="template-apply-grid">
                <div class="template-apply-cell template-apply-zone header">${e._t("thermostat")}</div>
                ${r.map((t) => x`
                  <div class="template-apply-cell header day">${e._shortWeekdayName(t)}</div>
                `)}
                ${n.map((t) => x`
                  <div class="template-apply-cell template-apply-zone" title=${e._friendlyEntityName(t)}>
                    ${e._friendlyEntityName(t)}
                  </div>
                  ${r.map((n) => {
		let r = e._templateApplyTargetKey(t, n);
		return x`
                      <label class="template-apply-cell template-apply-day" title=${e._weekdayName(n)}>
                        <input
                          type="checkbox"
                          .checked=${e._templateApplyTargets.has(r)}
                          @change=${(r) => e._toggleTemplateApplyTarget(t, n, r.currentTarget.checked)}
                        />
                      </label>
                    `;
	})}
                `)}
              </div>
            </div>
          ` : x`<span class="empty">${e._t("noManagedEntities")}</span>`}
    </div>
  `;
}
//#endregion
//#region src/velair/views/card-content.ts
function wl(e) {
	let t = e._effectiveView(), n = e._orderedZoneIds(e._data?.configured_entities ?? []), r = e._visibleZoneIds(e._data?.configured_entities ?? []), i = e._selectedEntity && r.includes(e._selectedEntity) ? e._selectedEntity : r[0], a = i ? e._data?.zones[i] : void 0, o = e._data && !e._data.temperature_migration.required ? Za(e._data.zones, (t) => e._entityTemperatureLimits(t), (t) => e._entityTemperatureStep(t)) : 0;
	return x`
    <ha-card>
      <div
        class=${e._schedulerMenuOpen ? "card scheduler-dialog-open" : "card"}
        data-view=${t}
      >
        ${e._schedulerMenuOpen ? x`<button class="card-scrim" type="button" @click=${e._closeSchedulerMenu}></button>` : C}

        ${e._error ? Qa(e, "error", e._error) : C}
        ${e._saveMessage ? Qa(e, "success", e._saveMessage) : C}
        ${e._loading && !e._data ? x`<div class="notice">${e._t("loading")}</div>` : C}
        ${e._data?.temperature_migration?.required ? x`
              <div class="temperature-migration-banner" role="alert">
                <ha-icon icon="mdi:thermometer-alert"></ha-icon>
                <div>
                  <strong>${e._t("temperatureMigrationRequired")}</strong>
                  <span>${e._t(e._data?.temperature_migration?.reason === "legacy_celsius_upgrade_reset_required" ? "temperatureLegacyResetStopped" : "temperatureMigrationStopped")}</span>
                </div>
              </div>
            ` : C}
        ${e._data?.operation_recovery ? x`
              <div class="temperature-migration-banner" role="alert">
                <ha-icon icon="mdi:database-alert"></ha-icon>
                <div>
                  <strong>${e._t("operationRecoveryRequired")}</strong>
                  <span>${e._t("operationRecoveryDescription")}</span>
                </div>
              </div>
            ` : C}
        ${o ? x`
              <div class="temperature-migration-banner" role="alert">
                <ha-icon icon="mdi:calendar-alert"></ha-icon>
                <div>
                  <strong>${e._t("incompatibleScheduleTargets")}</strong>
                  <span>${e._t("incompatibleScheduleTargetsDescription", { count: o })}</span>
                </div>
              </div>
            ` : C}

        ${e._data ? Tl(e, t, n, r, i, a) : C}
      </div>
    </ha-card>
  `;
}
function Tl(e, t, n, r, i, a) {
	return e._data?.temperature_migration?.required && t !== "settings" ? x`<div class="notice">${e._t(e._data.temperature_migration.reason === "legacy_celsius_upgrade_reset_required" ? "temperatureLegacyResetStopped" : "temperatureMigrationStopped")}</div>` : t === "overview" ? x`
      ${qo(e, n)}
      ${Jo(e, r)}
      ${xs(e, r)}
      ${ls(e, r)}
      ${Xo(e, r)}
    ` : t === "overview-status" ? qo(e, n) : t === "overview-boosts" ? Jo(e, r) : t === "overview-events" ? xs(e, r) : t === "overview-timeline" ? ls(e, r) : t === "overview-zones" ? Xo(e, r) : t === "schedules" ? ic(e, r, i, a) : t === "templates" ? Sl(e, i) : t === "sensors" ? Pc(e, r, Dl(e)) : t === "comfort" ? co(e, r, El(e)) : t === "preconditioning" ? Ms(e, r) : t === "settings" ? hl(e, r) : qo(e, n);
}
function El(e) {
	return {
		showCo2: e._config.show_comfort_co2 !== !1,
		showConfiguration: e._config.show_comfort_configuration !== !1,
		showHumidity: e._config.show_comfort_humidity !== !1,
		showTemperature: e._config.show_comfort_temperature !== !1
	};
}
function Dl(e) {
	return {
		showAssistSwitch: e._config.show_room_assist_switch !== !1,
		showDebounce: e._config.show_room_assist_debounce !== !1,
		showLiveStatus: e._config.show_room_assist_live_status !== !1,
		showMaxDelta: e._config.show_room_assist_max_delta !== !1,
		showRoomSensor: e._config.show_room_assist_sensor !== !1
	};
}
//#endregion
//#region \0@oxc-project+runtime@0.133.0/helpers/esm/decorate.js
function X(e, t, n, r) {
	var i = arguments.length, a = i < 3 ? t : r === null ? r = Object.getOwnPropertyDescriptor(t, n) : r, o;
	if (typeof Reflect == "object" && typeof Reflect.decorate == "function") a = Reflect.decorate(e, t, n, r);
	else for (var s = e.length - 1; s >= 0; s--) (o = e[s]) && (a = (i < 3 ? o(a) : i > 3 ? o(t, n, a) : o(t, n)) || a);
	return i > 3 && a && Object.defineProperty(t, n, a), a;
}
//#endregion
//#region src/velair/components/velair-card-element.ts
var Z = class extends E {
	constructor(...e) {
		super(...e), this.view = "overview-status", this._config = {}, this._changedNextEventIds = /* @__PURE__ */ new Set(), this._loading = !1, this._saving = !1, this._selectedWeekday = "monday", this._draftBlocks = [], this._dirty = !1, this._copyTargets = /* @__PURE__ */ new Set(), this._copying = !1, this._zoneTargets = /* @__PURE__ */ new Set(), this._applyingZones = !1, this._selectedTemplateKey = "", this._templateNameDraft = "", this._templateNameDraftKey = "", this._templateDraftBlocks = [], this._templateDraftKey = "", this._templateDirty = !1, this._templateApplyOpen = !1, this._templateApplyTargets = /* @__PURE__ */ new Set(), this._applyingTemplateTargets = !1, this._templateListCanScrollUp = !1, this._templateListCanScrollDown = !1, this._settingsSaving = !1, this._exportSections = new Set($e), this._expandedComfortZones = /* @__PURE__ */ new Set(), this._expandedPreconditioningZones = /* @__PURE__ */ new Set(), this._importSections = /* @__PURE__ */ new Set(), this._importFileName = "", this._pauseDurationMinutes = 60, this._schedulerMenuOpen = !1, this._nextEventsOpen = !1, this._nextEventChangeRevision = 0, this._timelineNow = /* @__PURE__ */ new Date(), this._subscribing = !1, this._temperatureUnitReloadPending = !1, this._overviewTimelineScrollInitialized = !1, this._hasExternalConfig = !1, this._handleTemplateListScroll = () => {
			this._syncTemplateListScrollIndicators();
		}, this._addBlock = (e = "schedule") => {
			Or(I(this), e);
		}, this._applySelectedTemplate = () => Wa(U(this)), this._pauseScheduler = async (e, t = {}) => {
			await ir(F(this), e, t);
		}, this._resumeScheduler = async (e = {}) => {
			await ar(F(this), e);
		}, this._handleSchedulerMenuToggle = (e) => {
			sr(F(this), e);
		}, this._toggleNextEvents = () => {
			cr(F(this));
		}, this._handleTimelineDragOver = (e) => {
			pi(e);
		}, this._handleTimelineDragEnd = () => {
			gi(z(this));
		}, this._handleTimelineResizeMove = (e) => {
			vi(z(this), e);
		}, this._handleTimelineResizeEnd = () => {
			yi(z(this));
		}, this._handleSettingsZoneDragEnd = () => {
			ui(R(this));
		};
	}
	get hass() {
		return this._hass;
	}
	set hass(e) {
		let t = this._hass, n = t?.config?.unit_system?.temperature !== e?.config?.unit_system?.temperature, r = Ht(j(this), e, t);
		this._hass = e, this._shouldUpdateForHass(e, t) && this.requestUpdate("hass", t), r && this._schedulePreconditioningRefresh(), n && t && this._data && (this._temperatureUnitReloadPending = !0, this._loadSchedule());
	}
	_api() {
		return this.hass ? new fn(this.hass) : void 0;
	}
	setConfig(e) {
		this._hasExternalConfig = !0;
		let t = this._selectedEntity;
		if (this._config = e ?? {}, this._selectedEntity = e?.selected_entity, this._data) {
			let e = this._visibleZoneIds(this._data.configured_entities);
			(!this._selectedEntity || !e.includes(this._selectedEntity)) && (this._selectedEntity = e[0]);
		}
		this._selectedWeekday = this._firstWeekday(), this._selectedEntity !== t && this._resetDraftBlocks();
	}
	connectedCallback() {
		super.connectedCallback(), this._loadSchedule(), this._subscribeUpdates(), this._syncTimelineNowTick();
	}
	disconnectedCallback() {
		super.disconnectedCallback(), this._unsubscribeUpdates &&= (this._unsubscribeUpdates(), void 0), this._clearSuccessNoticeTimer(), this._clearNextEventChangeTimer(), this._clearPreconditioningRefreshTimer(), this._clearOverviewTimelineDetail(), this._stopPauseTick(), this._stopTimelineNowTick();
	}
	getCardSize() {
		return 8;
	}
	getGridOptions() {
		return {
			columns: 12,
			min_columns: 6,
			rows: 8,
			min_rows: 5
		};
	}
	static getStubConfig() {
		return {
			title: "Velair",
			view: "overview-status"
		};
	}
	static getConfigElement() {
		return document.createElement("velair-card-editor");
	}
	updated(e) {
		e.has("hass") && this.hass && !this._data && !this._loading && this._loadSchedule(), e.has("hass") && this.hass && this._subscribeUpdates(), e.has("_saveMessage") && !this._saveMessage && this._clearSuccessNoticeTimer(), this._effectiveView() === "templates" && (e.has("view") || e.has("_data") || e.has("_selectedTemplateKey") || e.has("_templateListCanScrollUp") || e.has("_templateListCanScrollDown")) && window.requestAnimationFrame(() => this._syncTemplateListScrollIndicators()), (e.has("view") || e.has("_data")) && this._syncTimelineNowTick();
		let t = this._effectiveView();
		t === "overview" || t === "overview-timeline" ? this._data && !this._overviewTimelineScrollInitialized && (this._overviewTimelineScrollInitialized = !0, window.requestAnimationFrame(() => this._scrollOverviewTimelineToNow())) : this._overviewTimelineScrollInitialized = !1;
	}
	render() {
		return wl(Ya(this));
	}
	_effectiveView() {
		return Bt(this.getAttribute("view"), this.view, this._config.view);
	}
	_timelineShouldTick() {
		if (!this._data) return !1;
		let e = this._effectiveView();
		return e === "overview" || e.startsWith("overview-") || e === "schedules" || e === "templates";
	}
	_syncTimelineNowTick() {
		if (!this._timelineShouldTick()) {
			this._stopTimelineNowTick();
			return;
		}
		this._timelineNowTick === void 0 && (this._timelineNow = /* @__PURE__ */ new Date(), this._scheduleTimelineNowTick());
	}
	_scheduleTimelineNowTick() {
		this._stopTimelineNowTick();
		let e = /* @__PURE__ */ new Date(), t = Math.max(1e3, (60 - e.getSeconds()) * 1e3 - e.getMilliseconds() + 50);
		this._timelineNowTick = window.setTimeout(() => {
			this._timelineNowTick = void 0, this._timelineNow = /* @__PURE__ */ new Date(), this._syncTimelineNowTick();
		}, t);
	}
	_stopTimelineNowTick() {
		this._timelineNowTick !== void 0 && (window.clearTimeout(this._timelineNowTick), this._timelineNowTick = void 0);
	}
	_currentTimelineNow() {
		return this._timelineNow;
	}
	_scrollOverviewTimelineToNow() {
		let e = this.renderRoot.querySelector(".overview-timeline-scroll"), t = e?.querySelector(".overview-timeline-names");
		!e || !t || e.scrollWidth <= e.clientWidth + 1 || (e.scrollLeft = Un(Hn(this._currentTimelineNow()).left, e.scrollWidth, e.clientWidth, t.offsetWidth));
	}
	_showOverviewTimelineDetail(e, t, n, r) {
		window.matchMedia("(hover: none), (pointer: coarse)").matches && (r.preventDefault(), r.stopPropagation(), this._overviewTimelineDetail = t, this._overviewTimelineDetailAnchor = Math.max(0, Math.min(100, n)), this._overviewTimelineDetailEntityId = e);
	}
	_clearOverviewTimelineDetail() {
		this._overviewTimelineDetail = void 0, this._overviewTimelineDetailAnchor = void 0, this._overviewTimelineDetailEntityId = void 0;
	}
	_isCardView(e) {
		return zt(e);
	}
	_shouldUpdateForHass(e, t) {
		return Vt(j(this), e, t);
	}
	_canResumeScheduler() {
		return rr(F(this));
	}
	_selectTemplate(e) {
		ka(U(this), e);
	}
	_selectScheduleTemplate(e) {
		Aa(U(this), e);
	}
	_resetTemplateDraft(e) {
		ja(U(this), e);
	}
	_templateListClass(e) {
		return Ma(U(this), e);
	}
	_syncTemplateListScrollIndicators() {
		Na(U(this));
	}
	_setTemplateListScrollIndicators(e, t) {
		Pa(U(this), e, t);
	}
	_templateNameInputValue(e) {
		return Fa(U(this), e);
	}
	_updateTemplateNameDraft(e, t) {
		Ia(U(this), e, t);
	}
	async _createTemplate() {
		await La(U(this));
	}
	async _saveSelectedTemplateFromLibrary(e) {
		await Ra(U(this), e);
	}
	_uniqueTemplateName(e) {
		return za(U(this), e);
	}
	_scheduleTemplates() {
		return Mn(this._data?.templates, this._temperatureUnit());
	}
	_templateLabel(e) {
		return Nn(e);
	}
	async _loadSchedule() {
		if (!this._loading) do
			this._temperatureUnitReloadPending = !1, await Ni(V(this));
		while (this._temperatureUnitReloadPending);
	}
	async _subscribeUpdates() {
		await Pi(V(this));
	}
	_applyScheduleData(e, t = {}) {
		let n = wn(this._data?.next_events ?? [], e.next_events);
		Fi(V(this), e, t), this._markChangedNextEvents(n);
	}
	_schedulePreconditioningRefresh() {
		this._preconditioningRefreshTimer !== void 0 || !this.isConnected || (this._preconditioningRefreshTimer = window.setTimeout(() => {
			this._preconditioningRefreshTimer = void 0, this._loadSchedule();
		}, 1200));
	}
	_clearPreconditioningRefreshTimer() {
		this._preconditioningRefreshTimer !== void 0 && (window.clearTimeout(this._preconditioningRefreshTimer), this._preconditioningRefreshTimer = void 0);
	}
	_markChangedNextEvents(e) {
		e.length && (this._clearNextEventChangeTimer(!1), this._changedNextEventIds = new Set(e), this._nextEventChangeRevision += 1, this._nextEventChangeTimeout = window.setTimeout(() => {
			this._nextEventChangeTimeout = void 0, this._changedNextEventIds = /* @__PURE__ */ new Set();
		}, 2200));
	}
	_clearNextEventChangeTimer(e = !0) {
		this._nextEventChangeTimeout !== void 0 && (window.clearTimeout(this._nextEventChangeTimeout), this._nextEventChangeTimeout = void 0), e && this._changedNextEventIds.size && (this._changedNextEventIds = /* @__PURE__ */ new Set());
	}
	_resetDraftBlocks() {
		Ii(V(this));
	}
	_selectEntity(e) {
		Li(V(this), e);
	}
	_selectWeekday(e) {
		Ri(V(this), e);
	}
	_blocksForSource(e) {
		return zi(V(this), e);
	}
	_setBlocksForSource(e, t) {
		Bi(V(this), e, t);
	}
	_markBlocksDirty(e) {
		Vi(V(this), e);
	}
	_toggleTemplateApplyPanel() {
		Ba(U(this));
	}
	_templateApplyTargetKey(e, t) {
		return Va(e, t);
	}
	_toggleTemplateApplyTarget(e, t, n) {
		Ha(U(this), e, t, n);
	}
	async _applyTemplateToTargets(e) {
		await Ua(U(this), e);
	}
	async _saveTemplate(e) {
		await Ka(U(this), e);
	}
	_newTemplateKey() {
		return qa();
	}
	async _deleteSelectedTemplate() {
		await Ja(U(this));
	}
	_closeSchedulerMenu() {
		or(F(this));
	}
	_removeBlock(e, t = "schedule") {
		kr(I(this), e, t);
	}
	_updateDraftBlock(e, t, n, r = "schedule") {
		Ar(I(this), e, t, n, r);
	}
	_markDirty() {
		jr(I(this));
	}
	_handleTimelineDragStart(e, t, n) {
		fi(z(this), e, t, n);
	}
	_handleTimelineDrop(e, t = "schedule") {
		mi(z(this), e, t);
	}
	_handleTimelineResizeStart(e, t, n, r) {
		_i(z(this), e, t, n, r);
	}
	_resizeTimelineBlock(e, t, n, r = "schedule") {
		bi(z(this), e, t, n, r);
	}
	_setDraftBlockStart(e, t, n = {}, r = "schedule") {
		Mr(I(this), e, t, n, r);
	}
	_sortDraftBlocksByStart(e = "schedule") {
		xi(z(this), e);
	}
	_toggleCopyTarget(e, t) {
		Nr(I(this), e, t);
	}
	_toggleZoneTarget(e, t) {
		Pr(I(this), e, t);
	}
	_dismissNotice(e) {
		hr(mr(this), e);
	}
	_showSuccess(e) {
		gr(mr(this), e);
	}
	_successNoticeProgress() {
		return _r(mr(this));
	}
	_clearSuccessNoticeTimer(e = !0) {
		vr(mr(this), e);
	}
	_hasDraftValidationError(e = "schedule") {
		return Ir(Fr(this), e);
	}
	_temperatureError(e, t = "schedule") {
		return Lr(Fr(this), e, t);
	}
	async _saveSelectedDay() {
		await Di(B(this));
	}
	async _copySelectedDay() {
		await Oi(B(this));
	}
	async _applySelectedDayToZones() {
		await ki(B(this));
	}
	_normalizeDraftBlocks(e = "schedule") {
		return Ai(B(this), e);
	}
	_clampBlocksForEntity(e, t) {
		return ji(B(this), e, t);
	}
	_unsupportedModeError(e, t) {
		return Mi(B(this), e, t);
	}
	_pauseExpirationMs() {
		return lr(F(this));
	}
	_pauseProgressPercent(e) {
		return ur(F(this), e);
	}
	_syncPauseTick() {
		dr(F(this));
	}
	_nextCountdownExpirationMs() {
		return fr(F(this));
	}
	_stopPauseTick() {
		pr(F(this));
	}
	_timelineBlocks(e = "schedule") {
		return Si(z(this), e);
	}
	_inputValue(e) {
		return Rt(e);
	}
	_t(e, t = {}) {
		return Gt(j(this), e, t);
	}
	_language() {
		return M(j(this));
	}
	_weekdayName(e) {
		return Kt(j(this), e);
	}
	_shortWeekdayName(e) {
		return qt(j(this), e);
	}
	_modeLabel(e) {
		return this._dictionaryLabel("hvacModes", e);
	}
	_schedulerModeLabel(e) {
		return this._dictionaryLabel("schedulerModes", e);
	}
	_schedulerStatusLabel(e) {
		return this._dictionaryLabel("schedulerStatuses", e);
	}
	_hvacActionLabel(e) {
		return this._dictionaryLabel("hvacActions", e);
	}
	_dictionaryLabel(e, t) {
		return Jt(j(this), e, t);
	}
	_firstWeekday() {
		return Yt(j(this));
	}
	_orderedWeekdays() {
		return Xt(j(this));
	}
	_orderedZoneIds(e) {
		return Zt(j(this), e);
	}
	_visibleZoneIds(e) {
		return Qt(j(this), e);
	}
	async _updateSettingsFirstWeekday(e) {
		await ei(R(this), e);
	}
	async _saveSettings(e) {
		await ti(R(this), e);
	}
	async _saveZonePreconditioning(e, t) {
		await ni(R(this), e, t);
	}
	async _resolveTemperatureMigration(e) {
		let t = this._api(), n = this._data?.temperature_migration;
		if (!t || this._temperatureMigrationAction || !n?.required) return;
		let r = n.target_unit ?? this._temperatureUnit();
		if (window.confirm(this._t("temperatureMigrationConfirm", {
			source: e,
			target: r
		}))) {
			this._temperatureMigrationAction = e, this._error = void 0;
			try {
				let r = globalThis.crypto?.randomUUID?.() ?? `velair-${Date.now()}-${Math.random().toString(16).slice(2)}`;
				this._applyScheduleData(await t.resolveTemperatureMigration(e, r, n.temperature_revision ?? 0), { forceDraft: !0 }), gr(mr(this), this._t("temperatureMigrationComplete"));
			} catch (e) {
				this._error = e instanceof Error ? e.message : this._t("temperatureMigrationFailed");
			} finally {
				this._temperatureMigrationAction = void 0;
			}
		}
	}
	async _saveZoneComfort(e, t) {
		await ri(R(this), e, t);
	}
	_togglePreconditioningZone(e) {
		let t = new Set(this._expandedPreconditioningZones);
		t.has(e) ? t.delete(e) : t.add(e), this._expandedPreconditioningZones = t;
	}
	_toggleComfortZone(e) {
		let t = new Set(this._expandedComfortZones);
		t.has(e) ? t.delete(e) : t.add(e), this._expandedComfortZones = t;
	}
	async _resetZonePreconditioningLearning(e, t, n) {
		await ii(R(this), e, t, n);
	}
	async _resetZonePreconditioningSettings(e) {
		await ai(R(this), e);
	}
	_togglePortableSection(e, t, n) {
		Ur(L(this), e, t, n);
	}
	async _handlePortableImportFile(e) {
		await Wr(L(this), e);
	}
	async _exportPortableData() {
		await Gr(L(this));
	}
	async _importPortableData() {
		await Kr(L(this));
	}
	async _resetVelairData() {
		await qr(L(this));
	}
	_importAvailableSections() {
		return Jr(L(this));
	}
	_portableExportSummaryItems() {
		return Yr(L(this));
	}
	_portableImportSummaryItems() {
		return Xr(L(this));
	}
	_portableSummaryItem(e) {
		return Zr(L(this), e);
	}
	_portableSectionLabel(e) {
		return Qr(L(this), e);
	}
	_downloadPortablePayload(e) {
		$r(e);
	}
	_moveSettingsZone(e, t) {
		oi(R(this), e, t);
	}
	_handleSettingsZoneDragStart(e, t) {
		si(R(this), e, t);
	}
	_handleSettingsZoneDragOver(e) {
		ci(e);
	}
	_handleSettingsZoneDrop(e, t) {
		li(R(this), e, t);
	}
	_updateSettingsZoneOrder(e) {
		di(R(this), e);
	}
	_temperatureLimits(e = "schedule", t = this._selectedEntity) {
		return Qi(H(this), e, t);
	}
	_entityTemperatureLimits(e) {
		return $i(H(this), e);
	}
	_templateTemperatureLimits() {
		return ea(H(this));
	}
	_temperatureStep(e = "schedule", t = this._selectedEntity) {
		return ta(H(this), e, t);
	}
	_entityTemperatureStep(e) {
		return na(H(this), e);
	}
	_formatTemperatureLimit(e) {
		return It(e);
	}
	_entityExists(e) {
		return ra(H(this), e);
	}
	_entityFanModeOptions(e) {
		return ca(H(this), e);
	}
	_entityPresetModeOptions(e) {
		return ua(H(this), e);
	}
	_entitySwingModeOptions(e) {
		return fa(H(this), e);
	}
	_entitySwingHorizontalModeOptions(e) {
		return ma(H(this), e);
	}
	_entityHumidityLimits(e) {
		return ga(H(this), e);
	}
	_friendlyEntityName(e) {
		return ia(H(this), e);
	}
	_climateSupportedModes(e) {
		return aa(H(this), e);
	}
	_hvacModeOptions(e = "schedule") {
		return oa(H(this), e);
	}
	_fanModeOptions(e = "schedule") {
		return sa(H(this), e);
	}
	_presetModeOptions(e = "schedule") {
		return la(H(this), e);
	}
	_swingModeOptions(e = "schedule") {
		return da(H(this), e);
	}
	_swingHorizontalModeOptions(e = "schedule") {
		return pa(H(this), e);
	}
	_humidityLimits(e = "schedule") {
		return ha(H(this), e);
	}
	_uniqueModes(e) {
		return _a(e);
	}
	_entityDiagnostic(e) {
		return ya(H(this), e);
	}
	_climateProvidedData(e) {
		return ba(H(this), e);
	}
	_formatDateTime(e) {
		return xa(H(this), e);
	}
	_formatScheduleTime(e) {
		return Sa(H(this), e);
	}
	_dateLocale() {
		return Ca(H(this));
	}
	_formatRemaining(e) {
		return qi(e);
	}
	_formatTemperature(e, t) {
		return wa(H(this), e, t);
	}
	_formatEventAction(e) {
		return Ta(H(this), e);
	}
	_formatEventMode(e) {
		return Ea(H(this), e);
	}
	_temperatureUnit(e) {
		return Da(H(this), e);
	}
	static {
		this.styles = dn;
	}
};
X([D({ type: String })], Z.prototype, "view", void 0), X([O()], Z.prototype, "_config", void 0), X([O()], Z.prototype, "_changedNextEventIds", void 0), X([O()], Z.prototype, "_data", void 0), X([O()], Z.prototype, "_error", void 0), X([O()], Z.prototype, "_loading", void 0), X([O()], Z.prototype, "_saving", void 0), X([O()], Z.prototype, "_saveMessage", void 0), X([O()], Z.prototype, "_selectedEntity", void 0), X([O()], Z.prototype, "_selectedWeekday", void 0), X([O()], Z.prototype, "_draftBlocks", void 0), X([O()], Z.prototype, "_dirty", void 0), X([O()], Z.prototype, "_dirtyEntityId", void 0), X([O()], Z.prototype, "_copyTargets", void 0), X([O()], Z.prototype, "_copying", void 0), X([O()], Z.prototype, "_zoneTargets", void 0), X([O()], Z.prototype, "_applyingZones", void 0), X([O()], Z.prototype, "_selectedTemplateKey", void 0), X([O()], Z.prototype, "_templateNameDraft", void 0), X([O()], Z.prototype, "_templateNameDraftKey", void 0), X([O()], Z.prototype, "_templateDraftBlocks", void 0), X([O()], Z.prototype, "_templateDraftKey", void 0), X([O()], Z.prototype, "_templateDirty", void 0), X([O()], Z.prototype, "_templateApplyOpen", void 0), X([O()], Z.prototype, "_templateApplyTargets", void 0), X([O()], Z.prototype, "_applyingTemplateTargets", void 0), X([O()], Z.prototype, "_templateListCanScrollUp", void 0), X([O()], Z.prototype, "_templateListCanScrollDown", void 0), X([O()], Z.prototype, "_templateAction", void 0), X([O()], Z.prototype, "_settingsSaving", void 0), X([O()], Z.prototype, "_temperatureMigrationAction", void 0), X([O()], Z.prototype, "_maintenanceAction", void 0), X([O()], Z.prototype, "_portabilityAction", void 0), X([O()], Z.prototype, "_exportSections", void 0), X([O()], Z.prototype, "_expandedComfortZones", void 0), X([O()], Z.prototype, "_expandedPreconditioningZones", void 0), X([O()], Z.prototype, "_importSections", void 0), X([O()], Z.prototype, "_importPayload", void 0), X([O()], Z.prototype, "_importFileName", void 0), X([O()], Z.prototype, "_pauseDurationMinutes", void 0), X([O()], Z.prototype, "_controlAction", void 0), X([O()], Z.prototype, "_schedulerMenuOpen", void 0), X([O()], Z.prototype, "_nextEventsOpen", void 0), X([O()], Z.prototype, "_nextEventChangeRevision", void 0), X([O()], Z.prototype, "_overviewTimelineDetail", void 0), X([O()], Z.prototype, "_overviewTimelineDetailAnchor", void 0), X([O()], Z.prototype, "_overviewTimelineDetailEntityId", void 0), X([O()], Z.prototype, "_successNoticeStartedAt", void 0), X([O()], Z.prototype, "_timelineNow", void 0);
//#endregion
//#region src/velair/registration.ts
function Ol(e) {
	Object.entries(e.elements).forEach(([e, t]) => {
		customElements.get(e) || customElements.define(e, t);
	}), window.velairFrontendBuild = e.build, window.velairFrontendVersion = e.version || void 0, window.customCards = window.customCards ?? [], window.customCards.some((t) => t.type === e.customCard.type) || window.customCards.push(e.customCard);
}
//#endregion
//#region src/velair/views/card-editor.ts
var kl = new Set(["schedules"]), Al = new Set([
	"comfort",
	"overview",
	"overview-boosts",
	"overview-events",
	"overview-timeline",
	"overview-zones",
	"schedules",
	"templates",
	"sensors",
	"preconditioning",
	"settings"
]), jl = new Set(["comfort"]), Ml = [
	["show_comfort_configuration", "comfortCardShowConfiguration"],
	["show_comfort_temperature", "comfortCardShowTemperature"],
	["show_comfort_humidity", "comfortCardShowHumidity"],
	["show_comfort_co2", "comfortCardShowCo2"]
], Nl = new Set(["sensors"]), Pl = [
	["show_room_assist_switch", "roomAssistShowSwitch"],
	["show_room_assist_sensor", "roomAssistShowSensor"],
	["show_room_assist_max_delta", "roomAssistShowMaxDelta"],
	["show_room_assist_debounce", "roomAssistShowDebounce"],
	["show_room_assist_live_status", "roomAssistShowLiveStatus"]
], Q = class extends E {
	constructor(...e) {
		super(...e), this._config = {}, this._entities = [], this._loading = !1, this._loaded = !1, this._handleZoneDragEnd = () => {
			this._draggedEntity = void 0;
		};
	}
	setConfig(e) {
		this._config = e ?? {};
	}
	updated(e) {
		(e.has("hass") || e.has("_config")) && this.hass && this._showsThermostatOptions() && !this._loaded && !this._loading && this._loadManagedEntities();
	}
	render() {
		let e = this._firstWeekday(), t = this._orderedEntities(), n = this._showsFirstWeekdayOption(), r = this._showsComfortVisibilityOptions(), i = this._showsThermostatOptions(), a = this._showsRoomAssistVisibilityOptions();
		return x`
      <div class="editor">
        ${this._error ? x`<div class="notice error">${this._error}</div>` : C}
        ${this._loading ? x`<div class="notice">${this._t("loadingEntities")}</div>` : C}

        <label>
          <span>${this._t("title")}</span>
          <input
            type="text"
            .value=${this._config.title ?? ""}
            placeholder="Velair"
            @input=${(e) => this._updateConfig("title", this._inputValue(e))}
          />
        </label>

        <label>
          <span>${this._t("cardView")}</span>
          <select
            .value=${this._config.view ?? "overview-status"}
            @change=${(e) => this._updateView(this._inputValue(e))}
          >
            ${Qe.map((e) => x`
              <option
                value=${e}
                ?selected=${e === (this._config.view ?? "overview-status")}
              >
                ${this._viewLabel(e)}
              </option>
            `)}
          </select>
        </label>

        ${n ? x`
              <label class="first-weekday-option">
                <span>${this._t("firstWeekday")}</span>
                <select
                  .value=${e}
                  @change=${(e) => this._updateFirstWeekday(this._inputValue(e))}
                >
                  ${k.map((e) => x`<option value=${e}>${this._weekdayName(e)}</option>`)}
                </select>
              </label>
            ` : C}

        ${i ? x`
              <section class="zone-order">
                <div>
                  <span class="section-label">${this._t("cardThermostats")}</span>
                  <p>${this._t("cardThermostatsDescription")}</p>
                </div>
                <div class="zone-list">
                  ${t.length ? t.map((e, n) => this._renderZoneOrderRow(e, n, t.length)) : x`<span class="empty">${this._t("noManagedEntities")}</span>`}
                </div>
              </section>
            ` : C}

        ${r ? x`
              <section class="card-visibility-options">
                <div>
                  <span class="section-label">${this._t("comfortCardVisibility")}</span>
                  <p>${this._t("comfortCardVisibilityDescription")}</p>
                </div>
                <div class="visibility-list">
                  ${Ml.map(([e, t]) => this._renderVisibilityOption(e, t))}
                </div>
              </section>
            ` : C}

        ${a ? x`
              <section class="card-visibility-options">
                <div>
                  <span class="section-label">${this._t("roomAssistCardVisibility")}</span>
                  <p>${this._t("roomAssistCardVisibilityDescription")}</p>
                </div>
                <div class="visibility-list">
                  ${Pl.map(([e, t]) => this._renderVisibilityOption(e, t))}
                </div>
              </section>
            ` : C}
      </div>
    `;
	}
	_renderVisibilityOption(e, t) {
		return x`
      <label class="visibility-option">
        <input
          type="checkbox"
          .checked=${this._config[e] !== !1}
          @change=${(t) => this._toggleBooleanConfig(e, !!t.currentTarget.checked)}
        />
        <span>${this._t(t)}</span>
      </label>
    `;
	}
	_renderZoneOrderRow(e, t, n) {
		let r = this._selectedEntities().includes(e);
		return x`
      <div
        class="zone-row"
        draggable="true"
        @dragstart=${(t) => this._handleZoneDragStart(e, t)}
        @dragover=${(e) => this._handleZoneDragOver(e)}
        @drop=${(t) => this._handleZoneDrop(e, t)}
        @dragend=${this._handleZoneDragEnd}
      >
        <ha-icon icon="mdi:drag"></ha-icon>
        <label
          class="zone-visibility"
          title=${this._t(r ? "cardThermostatVisible" : "cardThermostatHidden")}
          @click=${(e) => e.stopPropagation()}
        >
          <input
            type="checkbox"
            .checked=${r}
            ?disabled=${r && this._selectedEntities().length <= 1}
            @change=${(t) => this._toggleEntityVisibility(e, !!t.currentTarget.checked)}
          />
        </label>
        <span>${this._friendlyEntityName(e)}</span>
        <div class="row-actions">
          <button
            class="icon-button"
            type="button"
            title=${this._t("moveUp")}
            ?disabled=${t === 0}
            @click=${() => this._moveZone(e, -1)}
          >
            <ha-icon icon="mdi:chevron-up"></ha-icon>
          </button>
          <button
            class="icon-button"
            type="button"
            title=${this._t("moveDown")}
            ?disabled=${t === n - 1}
            @click=${() => this._moveZone(e, 1)}
          >
            <ha-icon icon="mdi:chevron-down"></ha-icon>
          </button>
        </div>
      </div>
    `;
	}
	async _loadManagedEntities() {
		if (!(!this.hass || this._loading)) {
			this._loading = !0, this._error = void 0;
			try {
				let e = await this.hass.connection.sendMessagePromise({ type: "velair/get_schedule" });
				this._entities = e.configured_entities, this._loaded = !0;
			} catch (e) {
				this._error = e instanceof Error ? e.message : this._t("unableLoad"), this._entities = this._config.selected_entity ? [this._config.selected_entity] : [];
			} finally {
				this._loading = !1;
			}
		}
	}
	_orderedEntities() {
		let e = [...this._entities];
		this._config.selected_entity && !e.includes(this._config.selected_entity) && e.unshift(this._config.selected_entity);
		let t = new Set(e), n = (this._config.zone_order ?? []).filter((e) => t.has(e)), r = e.filter((e) => !n.includes(e));
		return [...n, ...r];
	}
	_selectedEntities() {
		let e = this._orderedEntities(), t = this._config.entities?.filter((t) => e.includes(t)) ?? [];
		return t.length ? t : e;
	}
	_updateConfig(e, t) {
		let n = { ...this._config }, r = t.trim();
		r ? n[e] = r : delete n[e], this._emitConfig(n);
	}
	_updateFirstWeekday(e) {
		let t = { ...this._config };
		t.first_weekday = k.includes(e) ? e : "monday", delete t.selected_weekday, this._emitConfig(t);
	}
	_toggleBooleanConfig(e, t) {
		let n = { ...this._config };
		t ? delete n[e] : n[e] = !1, this._emitConfig(n);
	}
	_moveZone(e, t) {
		let n = this._orderedEntities(), r = n.indexOf(e), i = r + t;
		if (r < 0 || i < 0 || i >= n.length) return;
		let a = [...n];
		[a[r], a[i]] = [a[i], a[r]], this._updateZoneOrder(a);
	}
	_handleZoneDragStart(e, t) {
		this._draggedEntity = e, t.dataTransfer?.setData("text/plain", e), t.dataTransfer && (t.dataTransfer.effectAllowed = "move");
	}
	_handleZoneDragOver(e) {
		e.preventDefault(), e.dataTransfer && (e.dataTransfer.dropEffect = "move");
	}
	_handleZoneDrop(e, t) {
		t.preventDefault();
		let n = t.dataTransfer?.getData("text/plain") || this._draggedEntity;
		if (this._draggedEntity = void 0, !n || n === e) return;
		let r = this._orderedEntities().filter((e) => e !== n), i = r.indexOf(e);
		i < 0 || (r.splice(i, 0, n), this._updateZoneOrder(r));
	}
	_updateZoneOrder(e) {
		let t = {
			...this._config,
			zone_order: e
		};
		delete t.selected_entity, this._emitConfig(t);
	}
	_toggleEntityVisibility(e, t) {
		let n = this._orderedEntities(), r = new Set(this._selectedEntities());
		t ? r.add(e) : r.size > 1 && r.delete(e);
		let i = n.filter((e) => r.has(e)), a = { ...this._config };
		i.length === n.length ? delete a.entities : a.entities = i, a.selected_entity && !i.includes(a.selected_entity) && delete a.selected_entity, this._emitConfig(a);
	}
	_emitConfig(e) {
		this._config = e, this.dispatchEvent(new CustomEvent("config-changed", {
			bubbles: !0,
			composed: !0,
			detail: { config: e }
		}));
	}
	_inputValue(e) {
		return e.currentTarget.value;
	}
	_t(e, t = {}) {
		return st(this._language(), e, t);
	}
	_updateView(e) {
		let t = { ...this._config };
		t.view = Qe.includes(e) ? e : "overview-status", this._emitConfig(t);
	}
	_language() {
		return ot(this.hass);
	}
	_firstWeekday() {
		let e = this._config.first_weekday ?? this._config.selected_weekday ?? "monday";
		return k.includes(e) ? e : "monday";
	}
	_weekdayName(e) {
		return ct(this._language(), e);
	}
	_viewLabel(e) {
		return this._t({
			overview: "overview",
			"overview-status": "cardViewOverviewStatus",
			"overview-boosts": "cardViewOverviewBoosts",
			"overview-events": "cardViewOverviewEvents",
			"overview-timeline": "cardViewOverviewTimeline",
			"overview-zones": "cardViewOverviewZones",
			schedules: "cardViewSchedules",
			templates: "templates",
			sensors: "cardViewSensors",
			comfort: "cardViewComfort",
			preconditioning: "preconditioning",
			settings: "settings"
		}[e]);
	}
	_selectedView() {
		let e = this._config.view;
		return e && Qe.includes(e) ? e : "overview-status";
	}
	_showsFirstWeekdayOption() {
		return kl.has(this._selectedView());
	}
	_showsComfortVisibilityOptions() {
		return jl.has(this._selectedView());
	}
	_showsThermostatOptions() {
		return Al.has(this._selectedView());
	}
	_showsRoomAssistVisibilityOptions() {
		return Nl.has(this._selectedView());
	}
	_friendlyEntityName(e) {
		return this.hass?.states?.[e]?.attributes?.friendly_name ?? e;
	}
	static {
		this.styles = u`
    .editor {
      display: grid;
      gap: 16px;
      padding: 4px 0;
    }

    label span {
      color: var(--secondary-text-color);
      display: block;
      font-size: 12px;
      margin-bottom: 4px;
    }

    p {
      color: var(--secondary-text-color);
      font-size: 12px;
      margin: 4px 0 0;
    }

    .section-label {
      color: var(--primary-text-color);
      display: block;
      font-weight: 600;
    }

    input,
    select {
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      box-sizing: border-box;
      color: var(--primary-text-color);
      font: inherit;
      min-height: 40px;
      padding: 8px;
      width: 100%;
    }

    .notice {
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      padding: 12px;
    }

    .notice.error {
      background: color-mix(in srgb, var(--error-color) 12%, transparent);
      border-color: var(--error-color);
    }

    .zone-order,
    .zone-list,
    .card-visibility-options,
    .visibility-list {
      display: grid;
      gap: 8px;
    }

    .zone-row {
      align-items: center;
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      cursor: grab;
      display: grid;
      gap: 8px;
      grid-template-columns: 24px 24px minmax(0, 1fr) auto;
      min-height: 42px;
      padding: 8px;
    }

    .zone-row:active {
      cursor: grabbing;
    }

    .zone-row span {
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .zone-visibility {
      align-items: center;
      display: inline-flex;
      justify-content: center;
      margin: 0;
      min-height: 24px;
    }

    .zone-visibility input {
      cursor: pointer;
      height: 16px;
      margin: 0;
      min-height: 0;
      padding: 0;
      width: 16px;
    }

    .zone-visibility input:disabled {
      cursor: default;
    }

    .visibility-option {
      align-items: center;
      background: var(--secondary-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      display: grid;
      gap: 8px;
      grid-template-columns: 20px minmax(0, 1fr);
      margin: 0;
      min-height: 42px;
      padding: 8px;
    }

    .visibility-option input {
      cursor: pointer;
      height: 16px;
      margin: 0;
      min-height: 0;
      padding: 0;
      width: 16px;
    }

    .visibility-option span {
      color: var(--primary-text-color);
      font-size: 13px;
      margin: 0;
    }

    .row-actions {
      display: inline-flex;
      gap: 4px;
    }

    .icon-button {
      align-items: center;
      background: var(--card-background-color);
      border: 1px solid var(--divider-color);
      border-radius: 8px;
      color: var(--primary-text-color);
      cursor: pointer;
      display: inline-flex;
      height: 32px;
      justify-content: center;
      width: 32px;
    }

    .icon-button:disabled {
      cursor: default;
      opacity: 0.45;
    }

    .empty {
      color: var(--secondary-text-color);
      font-size: 12px;
    }
  `;
	}
};
X([D({ attribute: !1 })], Q.prototype, "hass", void 0), X([O()], Q.prototype, "_config", void 0), X([O()], Q.prototype, "_entities", void 0), X([O()], Q.prototype, "_loading", void 0), X([O()], Q.prototype, "_loaded", void 0), X([O()], Q.prototype, "_error", void 0);
//#endregion
//#region src/velair/views/tabs.ts
var Fl = [
	{
		icon: "mdi:view-dashboard-outline",
		labelKey: "overview",
		view: "overview"
	},
	{
		icon: "mdi:calendar-clock",
		labelKey: "schedules",
		view: "schedules"
	},
	{
		icon: "mdi:content-copy",
		labelKey: "templates",
		view: "templates"
	},
	{
		icon: "mdi:home-thermometer-outline",
		labelKey: "sensors",
		view: "sensors"
	},
	{
		icon: "mdi:home-heart",
		labelKey: "comfort",
		view: "comfort"
	},
	{
		icon: "mdi:clock-fast",
		labelKey: "preconditioning",
		view: "preconditioning"
	},
	{
		icon: "mdi:cog-outline",
		labelKey: "settings",
		view: "settings"
	}
];
function Il(e) {
	return Fl.find((t) => t.view === e)?.icon ?? "mdi:circle";
}
//#endregion
//#region src/velair/views/panel.ts
var $ = class extends E {
	constructor(...e) {
		super(...e), this.narrow = !1, this._activeView = "overview";
	}
	render() {
		return x`
      <main class=${this.narrow ? "panel narrow" : "panel"}>
        <div class="header">
          <div class="toolbar">
            <ha-menu-button .hass=${this.hass} .narrow=${!0}></ha-menu-button>
            <div class="main-title">Velair</div>
          </div>
          <ha-tab-group
            class="panel-tabs"
            .active=${this._activeView}
            active=${this._activeView}
          >
            ${Ze.map((e) => x`
                <ha-tab-group-tab
                  slot="nav"
                  panel=${e}
                  ?active=${e === this._activeView}
                  @click=${(t) => this._handleTabClick(e, t)}
                >
                  ${this._t(e)}
                </ha-tab-group-tab>
              `)}
          </ha-tab-group>
        </div>
        <section class="view panel-content">
          ${this._renderActiveView()}
        </section>
      </main>
    `;
	}
	_renderActiveView() {
		return rc(this._activeView, x`<velair-panel-card
        .hass=${this.hass}
        .view=${this._activeView}
        view=${this._activeView}
      ></velair-panel-card>`);
	}
	_handleTabClick(e, t) {
		t.preventDefault(), t.stopPropagation(), this._selectView(e, t);
	}
	_selectView(e, t) {
		Ze.includes(e) && (this._activeView = e, this._syncTabGroupActive(e, t));
	}
	_syncTabGroupActive(e, t) {
		let n = t instanceof Event ? t.currentTarget : t, r = n?.matches("ha-tab-group") ? n : n?.closest("ha-tab-group");
		r && (r.active = e, r.setAttribute("active", e), r.querySelectorAll("ha-tab-group-tab").forEach((t) => {
			let n = t.getAttribute("panel") === e;
			t.toggleAttribute("active", n), t.setAttribute("aria-selected", String(n)), t.setAttribute("tabindex", n ? "0" : "-1");
		}));
	}
	_toPanelView(e) {
		return this._isPanelView(e) ? e : void 0;
	}
	_isPanelView(e) {
		return typeof e == "string" && Ze.includes(e);
	}
	_viewIcon(e) {
		return Il(e);
	}
	_t(e, t = {}) {
		return st(this._language(), e, t);
	}
	_language() {
		return ot(this.hass);
	}
	static {
		this.styles = u`
    :host {
      display: block;
      min-height: 100%;
    }

    .panel {
      box-sizing: border-box;
      display: grid;
      gap: 0;
      min-height: 100%;
      width: 100%;
    }

    .panel.narrow {
      min-height: 100%;
    }

    .header {
      background: var(--app-header-background-color, var(--primary-background-color));
      border-bottom: 1px solid var(--divider-color);
      color: var(--app-header-text-color, var(--primary-text-color));
      box-sizing: border-box;
      min-height: 104px;
      position: fixed;
      top: 0;
      width: 100%;
      z-index: 30;
    }

    .toolbar {
      align-items: center;
      box-sizing: border-box;
      display: flex;
      height: 56px;
      padding: 0 16px;
    }

    ha-menu-button {
      display: none;
      flex: 0 0 auto;
    }

    .main-title {
      color: inherit;
      flex: 0 1 auto;
      font-size: 22px;
      font-weight: 400;
      letter-spacing: 0;
      line-height: 56px;
      margin: 0 0 0 24px;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .panel-tabs {
      color: var(--primary-text-color);
      display: block;
      height: 48px;
      --track-width: 2px;
      width: 100%;
    }

    ha-tab-group::part(nav) {
      margin-inline: 24px;
      min-height: 48px;
    }

    ha-tab-group::part(tabs) {
      border-block-end: 0;
      border-bottom: 0;
      display: flex;
      min-height: 48px;
    }

    ha-tab-group::part(scroll-button) {
      color: var(--secondary-text-color);
      flex: 0 0 1.5em;
      width: 1.5em;
    }

    ha-tab-group::part(scroll-button__base) {
      min-width: 1.5em;
      padding-inline: 0;
      width: 1.5em;
    }

    ha-tab-group-tab {
      border-block-end: solid var(--track-width) transparent;
      box-sizing: border-box;
      color: var(--secondary-text-color);
      flex: 0 0 auto;
      font-size: var(--ha-font-size-m);
      font-weight: 700;
    }

    ha-tab-group-tab::part(base) {
      align-items: center;
      box-sizing: border-box;
      cursor: pointer;
      display: inline-flex;
      font: inherit;
      padding: 1em 1.5em;
      transition: color var(--wa-transition-fast) var(--wa-transition-easing);
      user-select: none;
      white-space: nowrap;
    }

    ha-tab-group-tab[active] {
      border-block-end: solid var(--track-width) var(--indicator-color);
      color: var(--primary-text-color);
      margin-block-end: 0 !important;
    }

    ha-tab-group-tab[active]::part(base) {
      color: var(--primary-text-color);
    }

    .panel-content {
      box-sizing: border-box;
      margin: 0 auto;
      max-width: 1120px;
      min-width: 0;
      padding: 120px 24px 24px;
      width: 100%;
    }

    velair-panel-card {
      display: block;
    }

    .panel-empty {
      align-items: center;
      display: grid;
      gap: 16px;
      grid-template-columns: auto minmax(0, 1fr);
      padding: 20px;
    }

    .panel-empty ha-icon {
      color: var(--primary-color);
      height: 28px;
      width: 28px;
    }

    .panel-empty h2 {
      color: var(--primary-text-color);
      font-size: 18px;
      font-weight: 600;
      letter-spacing: 0;
      margin: 0;
    }

    @media (max-width: 870px) {
      .header {
        min-height: 104px;
      }

      .toolbar {
        height: 56px;
        padding: 0 16px;
      }

      ha-menu-button {
        display: block;
      }

      .main-title {
        font-size: 22px;
        line-height: 56px;
      }

      .panel-content {
        padding-top: 120px;
      }
    }

    @media (max-width: 640px) {
      .header {
        min-height: 104px;
      }

      .toolbar {
        height: 56px;
        padding: 0 16px;
      }

      .panel-content {
        padding: 112px 8px 16px;
      }
    }
  `;
	}
};
X([D({ attribute: !1 })], $.prototype, "hass", void 0), X([D({ type: Boolean })], $.prototype, "narrow", void 0), X([D({ attribute: !1 })], $.prototype, "panel", void 0), X([D({ attribute: !1 })], $.prototype, "route", void 0), X([O()], $.prototype, "_activeView", void 0), Ol({
	build: n,
	customCard: {
		type: "velair-card",
		name: "Velair",
		description: "Climate automation that adapts to your life."
	},
	elements: {
		"velair-card": Z,
		"velair-card-editor": Q,
		"velair-panel-card": class extends Z {},
		"velair-sidebar-panel": $
	},
	version: r
});
//#endregion
export { Z as VelairCard };

//# sourceMappingURL=velair-card.js.map