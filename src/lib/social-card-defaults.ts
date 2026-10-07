export function getDefaultSocialCardAboutMe(role?: string | null) {
  if (role === 'STUDENT') {
    return 'Hey! I’m a proud GenZ IITian student. Happy to be part of the community!'
  }
  if (role === 'ADMIN') {
    return 'Hey! I’m an Admin at GenZ IITian. I teach here and I’m always happy to help.'
  }
  if (role === 'MODERATOR') {
    return 'Hey! I’m a Moderator at GenZ IITian. I’m always happy to help.'
  }
  return ''
}

export function getSocialCardAboutMe(aboutMe?: string | null, role?: string | null) {
  const customAboutMe = aboutMe?.trim()
  return customAboutMe || getDefaultSocialCardAboutMe(role)
}
