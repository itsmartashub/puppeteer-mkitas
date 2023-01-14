const fs = require("fs")
const puppeteer = require("puppeteer")
// console.log(puppeteer.executablePath())

;(async () => {
	const browser = await puppeteer.launch({
		headless: false, // bez ovog se ne otvara browser i ne vidimo u realtime sta se desava. To je dobro za production, ali za dev zelimo da vidimo i zato je headless: false
		defaultViewport: false,
		userDataDir: "./tmp", // amazon to rememeber our action. Amazon has capture.
	})
	const page = await browser.newPage()

	await page.goto(
		"https://www.amazon.com/s?i=computers-intl-ship&bbn=16225007011&rh=n%3A16225007011%2Cn%3A172504%2Cn%3A13983761&dc&fs=true&ds=v1%3Aw0az78RHtwqV7VBRTyGA4Dkju4oQ4XmBqbeT8K75y8w&qid=1673635065&rnid=172504&ref=sr_nr_n_10"
	)
	// await page.screenshot({path: 'amazon.png'})

	// let items = []
	let isBtnDisabled = false

	while (!isBtnDisabled) {
		// CEKAJ DA SE PRVI ITEM (NA SVAKOJ STR) POJAVI, JER BAR JEDAN IMA SIG NA SVAKOJ, PA I NA POSL, zato je search_result_0, tj nula.
		await page.waitForSelector('[data-cel-widget="search_result_0"]')

		const productsHandles = await page.$$(".s-main-slot.s-result-list.s-search-results.sg-row > .s-result-item")

		for (const productHandle of productsHandles) {
			let title = null
			let price = null
			let img = null

			try {
				title = await page.evaluate(el => el.querySelector("h2 > a > span").textContent, productHandle)
			} catch (error) {}

			try {
				price = await page.evaluate(
					el => el.querySelector(".a-price > .a-offscreen").textContent,
					productHandle
				)
			} catch (error) {}

			try {
				img = await page.evaluate(el => el.querySelector(".s-image").getAttribute("src"), productHandle)
			} catch (error) {}

			// console.log(`
			//     ----------------------------------------------
			//     🟢 ${title}
			//     💴 ${price}
			//     🌄 ${img}
			//     ----------------------------------------------
			// `)

			if (title) {
				// items.push({ title, price, img })
				// APPENDUJEMO A NEW LINE, DAKLE NE BRISEMO STO VEC IMA
				// fs.appendFile("results.csv", `${title.replace(/,/g, ".")},${price},${img}\n`, function (err) {
				// 	if (err) throw err
				// 	// console.log("Saved!")
				// })
				fs.appendFile(
					"results.csv",
					`🟢 ${title.replace(/,/g, ".")},\n💴 ${price},\n🌄 ${img}\n\n`,
					function (err) {
						if (err) throw err
						// console.log("Saved!")
					}
				)
				// morali smo re replice-ujemo sve zareze u naslovu, jer se krse sa separator zarezima za csv file te se podaci ne prikazuju dobro
			}
		}

		// CEKA DOK SE SELEKTOR (BTN) NE UCITA NA STRANICU
		await page.waitForSelector(".s-pagination-next", { visible: true }) // visible: true ceka da selector postane vidljiv na stranici. Mozda moze da bude vidljiv u kodu preko klase, ali ne i na stranici, pa ovo ceka da bude vidljiv na str.

		// PROVERAVAMO DA LI JE BTN "NEXT" DISABLED. AKO JESTE, NA POSLEDNJOJ SMO STRANICI, AKO NIJE PONOVI PROCES
		const is_disabled = (await page.$(".s-pagination-next.s-pagination-disabled")) !== null

		isBtnDisabled = is_disabled

		if (!is_disabled) {
			await Promise.all([
				// KLIKNI NA SLEDECU STRANICU, I PONOVI PROCES
				page.click(".s-pagination-next"),

				// CEKAMO DA SE STRANICA PROMENI PRE NEGO STO PONOVO FOR-LOOP KRENE, ZELIMO PRODUKTI DA SE APDEJTUJU. Inace imamo vise itema, bug
				page.waitForNavigation({ waitUntil: "networkidle2" }),
				/*
                waitUntil: When to consider navigation succeeded, defaults to LOAD. Given an array of event strings, navigation is considered to be successful after all events have been fired. Events can be either:
                networkidle2: consider navigation to be finished when there are no more than 2 network connections for at least 500 ms.
                */
			])
		}
	}

	// console.log(items)
	// console.log(items.length)

	await browser.close()
})()
