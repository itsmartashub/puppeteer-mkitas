const fs = require("fs")
const { Cluster } = require("puppeteer-cluster")

const urls = [
	"https://www.amazon.com/s?k=amazonbasics&pd_rd_r=03e5e33c-4faf-452d-8173-4a34efcf3524&pd_rd_w=EQNRr&pd_rd_wg=PygJX&pf_rd_p=9349ffb9-3aaa-476f-8532-6a4a5c3da3e7&pf_rd_r=8RYH7VRZ4HSKWWG0NEX3&ref=pd_gw_unk",
	"https://www.amazon.com/s?k=oculus&i=electronics-intl-ship&pd_rd_r=03e5e33c-4faf-452d-8173-4a34efcf3524&pd_rd_w=iMBhG&pd_rd_wg=PygJX&pf_rd_p=5c71b8eb-e4c7-4ea1-bf40-b57ee72e089f&pf_rd_r=8RYH7VRZ4HSKWWG0NEX3&ref=pd_gw_unk",
]

;(async () => {
	const cluster = await Cluster.launch({
		concurrency: Cluster.CONCURRENCY_CONTEXT,
		maxConcurrency: 10, // how much jobs to do
		monitor: true,
		timeout: 500000, // morala sam ovo da stavim jer sam imala Error za Timeout 30000. Drugi URL scrapuje do 5. stranice i onda zabode i ugasi.
		puppeteerOptions: {
			headless: false,
			slowMo: 50,
			defaultViewport: false,
			userDataDir: "./tmp",
		},
	})

	cluster.on("taskerror", (err, data) => {
		console.log(`Error crawling ${data}: ${err.message}`)
	})

	//? Cluster Task
	await cluster.task(async ({ page, data: url }) => {
		let status = await page.goto(url)
		status = status.status()
		console.log(status)

		let isBtnDisabled = false

		while (!isBtnDisabled) {
			/*
            CEKAJ DA SE PRVI ITEM (NA SVAKOJ STR) POJAVI, JER BAR JEDAN IMA SIG NA SVAKOJ, PA I NA POSL, zato je search_result_0, tj nula.
            */
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

				/* console.log(`
				    ----------------------------------------------
				    🟢 ${title}
				    💴 ${price}
				    🌄 ${img}
				    ----------------------------------------------
				`) */

				if (title) {
					// items.push({ title, price, img })

					// fs.appendFile("results.csv", `${title.replace(/,/g, ".")},${price},${img}\n`, function (err) {
					// 	if (err) throw err
					// 	// console.log("Saved!")
					// })

					/*
                    APPENDUJEMO A NEW LINE, DAKLE NE BRISEMO STO VEC IMA
                    */
					fs.appendFile(
						"results.csv",
						`🟢 ${title.replace(/,/g, ".")},\n💴 ${price},\n🌄 ${img}\n\n`,
						function (err) {
							if (err) throw err
							// console.log("Saved!")
						}
					)
					/*
                    morali smo da replice-ujemo sve zareze u naslovu, jer se krse sa separator zarezima za csv file te se podaci ne prikazuju dobro */
				}
			}

			// CEKA DOK SE SELEKTOR (BTN) NE UCITA NA STRANICU
			await page.waitForSelector(".s-pagination-next", { visible: true })
			/*
            visible: true ceka da selector postane vidljiv na stranici. Mozda moze da bude vidljiv u kodu preko klase, ali ne i na stranici, pa ovo ceka da bude vidljiv na str. */

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
	})

	for (const url of urls) {
		await cluster.queue(url)
	}

	await cluster.idle()
	await cluster.close()
})()

/* 

==============  CLUSTER  ==============

🟢 CONCURRENCY_PAGE 🟢
    - Otvara svaki novi URL u novom window-u. Koriste se kukiji, tj izmedju "jobs" se deli sve (cookies, localStorage, etc). Ne utice na druge jobs iliti tasks.

🟢 CONCURRENCY_CONTEXT 🟢
    - Bilo da je CONCURRENCY_CONTEXT ili CONCURRENCY_PAGE, ono otvara NOVI WINDOW, nova stranica za svaki URL. Razlika je samo sto CONTEXT otvara u inkognito modu. Ne deli sa jobs kukijeve itd.
    - Incognito page
    - The default option is Cluster.CONCURRENCY_CONTEXT, but it is recommended to always specify which one you want to use.

    🔴 maxConcurrency 
    - Ovim govorimo koliko stranica (jobs/tasks) zelimo da scrapujemo u isto vreme. Recimo ako imamo da scrapujemo 1000 stranica, i stavimo za maxConcurrency da bude 2, scrapovace se 2 po 2 stranice. za maxConcurrency nema limita, msm sve je do toga koliko nas kompjuter moze da hendluje.

    🔵 cluster.on()
    🔵 cluster.task()
    🔵 cluster.queue()
    🔵 cluster.idle()
    🔵 cluster.close()

*/
