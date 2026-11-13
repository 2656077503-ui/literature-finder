import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'文献查询服务',description:'输入 DOI 或题目，查找文献并提交人工查询需求。'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="zh-CN"><body>{children}</body></html>}
