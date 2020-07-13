export async function sleep(timeMs)
{
  return new Promise(resolve => {
    setTimeout(resolve, timeMs)
  })
}

export async function fetchRange(url, ...ranges)
{
  return fetch(url, {
    method: 'GET',
    headers: new Headers({
      'Range': 'bytes=' + ranges
        .map(range => range[0] + '-' + range[1])
        .join(', ')
    })
  })
}