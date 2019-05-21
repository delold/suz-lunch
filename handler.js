const url = require('url')
const { JSDOM, CookieJar } = require('jsdom')
const fetchCookie = require('fetch-cookie/node-fetch')
const nodeFetch = require('node-fetch')

const submitForm = (selector, dom, cookieJar, prefill = {}) => {
  const fetch = fetchCookie(nodeFetch, cookieJar)
  const formTarget = url.resolve(dom.window.location.href, dom.window.document.querySelector(selector).action)
  const formData = Array.from(dom.window.document.querySelector(selector).elements).reduce((memo, item) => {
    if (item.name) {
      let value = item.value
      for (let needle in prefill) {
        if (item.name.indexOf(needle) >= 0) {
          value = prefill[needle]
          break
        }
      }
      memo[item.name] = `${encodeURIComponent(item.name)}=${encodeURIComponent(value)}`
    }
    return memo 
  }, {})

  return fetch(formTarget, {
    method: 'POST',
    body: Object.values(formData).join("&"),
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
  }).then((res) => res.text().then((text) => new JSDOM(text, { url: res.url, cookieJar })))
}

const fetchAmount = async ({ username, password, type = 'cvut' }) => {
  try {
    if (!username || username.length <= 0 || !password || password.length <= 0) throw Error('Login invalid')
    if (type !== 'cvut' && type !== 'vscht') throw Error('Invalid parameters')

    const cookieJar = new CookieJar()
    let dom = await JSDOM.fromURL('https://agata.suz.cvut.cz/secure/index.php', { cookieJar })

    const form = JSDOM.fragment(dom.window.document.querySelector(`noscript`).innerHTML)
    const baseLink = form.querySelector(`[http-equiv="refresh"]`).content.split(';')[1].replace('url=', '')
    const noScriptLink = url.resolve(dom.window.document.location.href, decodeURI(baseLink))

    dom = await JSDOM.fromURL(noScriptLink, { cookieJar })
    const agataCvut = dom.window.document.querySelector(`[href*='${type}']`)

    dom = await JSDOM.fromURL(agataCvut.href, { cookieJar })
    dom = await submitForm('form', dom, cookieJar, { username, password })
    if (dom.window.document.querySelector(`[color="red"]`)) {
      throw Error('Login failed')
    }

    dom = await submitForm('form', dom, cookieJar)

    let data = []
    const tables = dom.window.document.querySelectorAll('table')
    if (tables.length > 0) {
      data = Array.from(tables[0].querySelectorAll('tbody tr')).map((item) => ({
        name: item.querySelector(`td:nth-child(2)`).textContent,
        expire: item.querySelector(`td:nth-child(4)`).textContent,
        amount: item.querySelector(`td:nth-child(5)`).textContent
      }))
    }

    return { success: true, data }
  } catch (err) {
    console.error(err)
    return { success: false, data: err.toString() }
  }
}

const fetchMenu = async ({ id }) => {
  try {
    if (typeof id === undefined || !id) throw Error('Invalid parameter')
    let dom = await JSDOM.fromURL(`https://agata.suz.cvut.cz/jidelnicky/index.php?clPodsystem=${id}`)
    let rows = dom.window.document.querySelectorAll('table tbody tr')

    const meals = []

    let name
    let choices = []

    for (let item of rows) {
      let header = item.querySelector('.thkategorie')
      if (header) {
        if (choices && choices.length > 0) {
          meals.push({ name, choices })
          choices = []
        }
        name = header.textContent
      } else {
        const columns = item.querySelectorAll('td')
        if (columns.length >= 7) {
          const meal = {
            weight: columns[0].textContent,
            name: columns[1].textContent,
            alergens: '',
            picture: '',
            studentPrice: columns[4].textContent,
            otherPrice: columns[5].textContent,
            places: Array.from(columns[6].querySelectorAll('.label')).map(item => {
              let title = item.getAttribute('title')
              if (title) title = title.trim()
              return title
            })
          }

          if (meal.weight) meal.weight = meal.weight.trim()
          if (meal.name) meal.name = meal.name.trim()
          if (meal.studentPrice) meal.studentPrice = meal.studentPrice.replace(/\\n/, '').trim()
          if (meal.otherPrice) meal.otherPrice = meal.otherPrice.replace(/\\n/, '').trim()

          if (columns[2].querySelector('a')) {
            meal.alergens = columns[2].querySelector('a').getAttribute('title')
            if (meal.alergens) meal.alergens = meal.alergens.replace('Alergeny: ', '').trim()
          }

          if (columns[3].querySelector('img')) {
            meal.picture = columns[3].querySelector('a').getAttribute('href')
            if (meal.picture) meal.picture = url.resolve(dom.window.location.href, meal.picture).replace('imgshow.php', 'showfoto.php')
          }

          choices.push(meal)
        }
      }
    }

    if (choices && choices.length > 0) meals.push({ name, choices })
    return { success: (meals.length > 0), data: meals }
  } catch (err) {
    console.error(err)
    return { success: false, data: err.toString() }
  }
}

const getMenzaImage = (src) => {
  switch (src) {
    case '15': return 'https://www.suz.cvut.cz/images/gallery/archicafe4.jpg'
    case '5': return 'https://www.suz.cvut.cz/images/gallery/menza---canteen25.jpg'
    case '12': return 'https://www.suz.cvut.cz/images/gallery/buffet---fsv3.jpg'
    case '9': return 'https://www.suz.cvut.cz/images/gallery/restarurace-kokos1.jpg'
    case '4': return 'https://www.suz.cvut.cz/images/gallery/canteen9.jpg'
    case '1': return 'https://www.suz.cvut.cz/images/gallery/menza-strahov---canteen.jpg'
    case '2': return 'https://www.suz.cvut.cz/images/gallery/studentsky-dum6.jpg'
    case '10': return 'https://www.suz.cvut.cz/images/gallery/pizzerie-la-fontanella13.jpg'
    case '3': return 'https://www.suz.cvut.cz/images/gallery/technicka-menza1.jpg'
    case '6': return 'https://www.suz.cvut.cz/images/gallery/vydejna-horska---canteen7.jpg'
    case '8': return 'https://www.suz.cvut.cz/images/gallery/vydejna-karlovo-namesti.jpg'
  }

  return null
}


const fetchRestaurants = async () => {
  const dom = await JSDOM.fromURL(`https://agata.suz.cvut.cz/jidelnicky/index.php`)
  const rows = dom.window.document.querySelectorAll(`*[href*="clPodsystem"]`)
  const result = []

  try {
    for (let item of rows) {
      if (item.parentElement.style.display !== "none") {
        const id = item.href.split("clPodsystem=").pop()
        result.push({
          id,
          name: item.innerHTML,
          image: getMenzaImage(id)
        })
      }
    }
  
    return { success: true, data: result }
  } catch (err) {
    console.error(err)
    return { success: false, data: err.toString() }
  }
}

const lambdaCallback = (callback) => async (event) => {
  let payload = null
  let statusCode = 200
  try {
    payload = await callback((event.body && JSON.parse(event.body)) || null)
  } catch (err) {
    statusCode = 500
    payload = { success: false, data: err.message }
  }

  return {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Credentials': true,
      'Content-Type': 'application/json',
    },
    statusCode,
    body: JSON.stringify(payload)
  }
}

module.exports.menu = lambdaCallback(fetchMenu)

module.exports.list = lambdaCallback(fetchRestaurants)

module.exports.balance = lambdaCallback(fetchAmount)