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

export function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
}