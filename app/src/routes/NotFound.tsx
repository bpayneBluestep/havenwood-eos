import { Link } from 'react-router-dom'

export default function NotFound() {
  return (
    <div className="page">
      <div className="card" style={{ maxWidth: 460, margin: '8vh auto' }}>
        <div className="card__head"><h2>Not a page</h2></div>
        <div className="card__body">
          <p style={{ marginTop: 0 }} className="muted">
            That address isn't part of Traction.
          </p>
          <Link className="btn btn--primary" to="/">Go to My 90</Link>
        </div>
      </div>
    </div>
  )
}
