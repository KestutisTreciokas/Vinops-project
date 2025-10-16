export default function DocIcon({className=""}:{className?:string}) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none"
         xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M7 3h6l4 4v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M13 3v5h5" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"/>
      <path d="M8.5 12h7M8.5 15.5h7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
