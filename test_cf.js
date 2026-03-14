const url =
  'https://api.curse.tools/v1/cf/mods/search?gameId=432&classId=6&searchFilter=jei&sortField=2&sortOrder=desc&pageSize=20'

fetch(url, {
  headers: {
    Accept: 'application/json'
  }
})
  .then(async (res) => {
    console.log('Status:', res.status)
    const text = await res.text()
    console.log('Body:', text.substring(0, 500))
  })
  .catch((err) => console.error(err))
