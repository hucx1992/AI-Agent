/** 人物档案知识库：仅服务端查询用，不要整表塞进 prompt */
export interface PersonProfile {
  name: string
  gender?: string
  age?: number
  children?: Array<{ name: string; relation?: string }>
  note?: string
}

export const personProfiles: PersonProfile[] = [
  {
    name: '张三',
    gender: '男',
    age: 30,
    children: [{ name: '张四', relation: '儿子' }],
  },  {
    name: '李三',
    gender: '女',
    age: 30,
  }, {
    name: '李大',
    gender: '女',
    age: 34,
  }, {
    name: '李二',
    gender: '男',
    age: 31,
  },
]

export function findPersonByName(name: string): PersonProfile | undefined {
  const key = name.trim()
  return personProfiles.find(
    (p) => p.name === key || p.children?.some((c) => c.name === key),
  )
}
